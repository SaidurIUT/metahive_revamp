"use client";
import React, { useEffect, useRef, useState } from "react";
import kaboom, {
  type GameObj,
  type KaboomCtx,
  type PosComp,
  type SpriteComp,
  type AreaComp,
  type BodyComp,
  type AnchorComp,
  type TextComp,
  type ColorComp,
} from "kaboom";
import WebSocketService from "../services/WebSocketService";
import Chatbox from "./Chatbox";
import DiscordDialog from "./DiscordDialog";
import {
  joinVideo,
  leaveVideo,
  toggleCamera,
  toggleMic,
  toggleScreenShare,
} from "./AgoraCall";
import {
  FaComments,
  FaVideo,
  FaVideoSlash,
  FaMicrophone,
  FaMicrophoneSlash,
  FaDesktop,
  FaDiscord,
  FaDoorOpen,
} from "react-icons/fa";
import styles from "./GameCanvas.module.css";
import RemoteVideoModal from "./RemoteVideoModal";

// const process.env.NEXT_PUBLIC_AGORA_APP_ID = "aa57b40426c74add85bb5dcae4557ef6";

type GameCanvasProps = {
  playerName: string;
  roomId: string;
};

type RemotePlayerData = {
  x: number;
  y: number;
  direction?: string;
  isMoving?: boolean;
  username?: string;
};

type RemoteStream = {
  id: string;
  play: (video: HTMLVideoElement) => void;
};

type PlayerGameObj = GameObj<
  PosComp &
    SpriteComp &
    AreaComp &
    BodyComp &
    AnchorComp & {
      speed: number;
      isMoving: boolean;
      direction: string;
    }
>;

type PlayerNameTagGameObj = GameObj<
  TextComp &
    PosComp &
    AnchorComp &
    ColorComp
>;

type RemotePlayerSprite = GameObj<
  PosComp &
    SpriteComp &
    AreaComp &
    AnchorComp & {
      id: string;
      username?: string;
      isMoving?: boolean;
      direction: string;
      targetX: number;
      targetY: number;
      previousX: number;
      previousY: number;
      lastUpdate: number;
      currentAnim: string;
    }
>;

function GameCanvas({ playerName, roomId }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<KaboomCtx | null>(null);

  const playerRef = useRef<PlayerGameObj | null>(null);
  const playerNameTagRef = useRef<PlayerNameTagGameObj | null>(null);
  const didCreateLocalSpriteRef = useRef(false);

  const otherPlayers = useRef<
    Record<
      string,
      {
        sprite: RemotePlayerSprite;
        nameTag?: PlayerNameTagGameObj;
        lastUpdate: number;
        previousX: number;
        previousY: number;
        currentAnim: string;
      }
    >
  >({});

  const activeCallRef = useRef(false);

  const nearChairRef = useRef<"up" | "down" | "left" | "right" | null>(null);
  const isPlayerSittingRef = useRef(false);
  const CHAIR_PROXIMITY = 40;

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isVideoVisible, setIsVideoVisible] = useState(false);

  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);

  const [isDiscordOpen, setIsDiscordOpen] = useState(false);
  const [selectedDiscordChannel, setSelectedDiscordChannel] = useState<string | null>(null);

  const openDiscord = () => setIsDiscordOpen(true);
  const closeDiscord = () => setIsDiscordOpen(false);

  const [zoomUid, setZoomUid] = useState<string | null>(null);

  const PROXIMITY_THRESHOLD = 100;
  const PLAYER_SPEED = 3600;
  const UPDATE_INTERVAL = 1000 / 30;
  const INTERPOLATION_DELAY = 100;
  const CLEANUP_DELAY = 1000;

  const prevMovingRef = useRef(false);
  const prevDirectionRef = useRef("down");
  const lastUpdateRef = useRef(0);

  const cleanupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const k = kaboom({
      global: false,
      width: 800,
      height: 500,
      scale: 2,
      debug: false,
      background: [0, 0, 0, 1],
      canvas: canvasRef.current ?? undefined,
      letterbox: false,
    });
    gameRef.current = k;

    // keep references to every object/listener you create
    const spawnedObjects: GameObj[] = [];
    const cancelHandlers: { cancel: () => void }[] = [];

    // wrap k.add so every object you spawn is tracked automatically
    const trackedAdd: typeof k.add = (...args) => {
      const obj = k.add(...args);
      spawnedObjects.push(obj);
      return obj;
    };

    const playerSpriteAsset = k.loadSprite("player", "/ash.png", {
      sliceX: 52,
      sliceY: 1,
      anims: {
        "idle-right": { from: 0, to: 5, speed: 10, loop: true },
        "idle-up": { from: 6, to: 11, speed: 10, loop: true },
        "idle-left": { from: 12, to: 17, speed: 10, loop: true },
        "idle-down": { from: 18, to: 23, speed: 10, loop: true },
        "run-right": { from: 24, to: 29, speed: 15, loop: true },
        "run-up": { from: 30, to: 35, speed: 15, loop: true },
        "run-left": { from: 36, to: 41, speed: 15, loop: true },
        "run-down": { from: 42, to: 47, speed: 15, loop: true },
        "sit-down": { from: 48, to: 48, speed: 1, loop: false },
        "sit-up": { from: 49, to: 49, speed: 1, loop: false },
        "sit-left": { from: 50, to: 50, speed: 1, loop: false },
        "sit-right": { from: 51, to: 51, speed: 1, loop: false },
      },
    });

    const mapSpriteAsset = k.loadSprite("map", "/mapfinal1.png");

    const startGame = async () => {
      try {
        await playerSpriteAsset;
        await mapSpriteAsset;
        const mapResp = await fetch("/mapfinal1.json");
        if (!mapResp.ok) {
          throw new Error(`Failed to load map.json: ${mapResp.statusText}`);
        }
        const mapData = await mapResp.json();

        trackedAdd([
          k.sprite("map"),
          k.pos(0, 0),
          k.anchor("topleft"),
        ]);

        //         k.add([
        //   k.sprite("map"),
        //   k.pos(0, 0),
        //   k.anchor("topleft"),
        // ]);

        const boundariesLayer = mapData.layers.find((l: any) => l.name === "boundaries");
        if (boundariesLayer?.objects) {
          boundariesLayer.objects.forEach((obj: any) => {
            trackedAdd([
              k.rect(obj.width, obj.height),
              k.pos(obj.x, obj.y),
              k.area(),
              k.body({ isStatic: true }),
              k.opacity(0),
              "boundary",
            ]);
            //             k.add([
            //   k.rect(obj.width, obj.height),
            //   k.pos(obj.x, obj.y),
            //   k.area(),
            //   k.body({ isStatic: true }),
            //   k.opacity(0),
            //   "boundary",
            // ]);
          });
        }

        const chairDirections = ["up", "down", "left", "right"] as const;
        chairDirections.forEach((direction) => {
          const chairLayer = mapData.layers.find((ly: any) => ly.name === `chair-${direction}`);
          if (chairLayer?.objects) {
            chairLayer.objects.forEach((chair: any) => {
              trackedAdd([
                k.rect(chair.width, chair.height),
                k.pos(chair.x, chair.y),
                k.area(),
                k.opacity(0),
                `chair-${direction}`,
                "chair",
              ]);

              //               k.add([
              //   k.rect(chair.width, chair.height),
              //   k.pos(chair.x, chair.y),
              //   k.area(),
              //   k.opacity(0),
              //   `chair-${direction}`,
              //   "chair",
              // ]);
            });
          }
        });

        trackedAdd([
          k.text("Press E to sit", { size: 16, width: 200 }),
          k.pos(0, 0),
          k.anchor("center"),
          k.opacity(0),
          k.fixed(),
          "prompt",
        ]);

        //         k.add([
        //   k.text("Press E to sit", { size: 16, width: 200 }),
        //   k.pos(0, 0),
        //   k.anchor("center"),
        //   k.opacity(0),
        //   k.fixed(),
        //   "prompt",
        // ]);

        // cancelHandlers.push(

          
          k.onUpdate(() => {
          const player = playerRef.current;
          if (!player) return;

          let inProximity = false;
          Object.values(otherPlayers.current).forEach((op) => {
            const dist = player.pos.dist(op.sprite.pos);
            if (dist < PROXIMITY_THRESHOLD) {
              inProximity = true;
            }
          });
          if (inProximity && !activeCallRef.current) {
            try {
              joinVideo(process.env.NEXT_PUBLIC_AGORA_APP_ID, roomId);
              activeCallRef.current = true;
              const localVid = document.getElementById("local-video");
              if (localVid) localVid.style.display = "block";
            } catch (err) {
              console.error("Error starting video call:", err);
            }
          } else if (!inProximity && activeCallRef.current) {
            try {
              leaveVideo();
              activeCallRef.current = false;
              const localVid = document.getElementById("local-video");
              if (localVid) localVid.style.display = "none";
            } catch (err) {
              console.error("Error ending video call:", err);
            }
          }
          
          const currentTime = Date.now();
          let dx = 0;
          let dy = 0;
          let newDir = player.direction;
          let moving = false;

          if (!isPlayerSittingRef.current) {
            const chairs = k.get("chair");
            let nearestChair: "up" | "down" | "left" | "right" | null = null;
            let shortestDist = Infinity;
            chairs.forEach((chair: any) => {
              const dist = player.pos.dist(chair.pos);
              if (dist < CHAIR_PROXIMITY && dist < shortestDist) {
                shortestDist = dist;
                chairDirections.forEach((dir) => {
                  if (chair.is(`chair-${dir}`)) {
                    nearestChair = dir;
                  }
                });
              }
            });
            nearChairRef.current = nearestChair;
            const prompt = k.get("prompt")[0];
            if (nearestChair) {
              prompt.pos.x = player.pos.x;
              prompt.pos.y = player.pos.y - 40;
              prompt.opacity = 1;
            } else {
              prompt.opacity = 0;
            }
          }
          
          if (k.isKeyDown("left")) {
            dx = -1;
            newDir = "left";
            moving = true;
          }
          if (k.isKeyDown("right")) {
            dx = 1;
            newDir = "right";
            moving = true;
          }
          if (k.isKeyDown("up")) {
            dy = -1;
            newDir = "up";
            moving = true;
          }
          if (k.isKeyDown("down")) {
            dy = 1;
            newDir = "down";
            moving = true;
          }
          
          k.onKeyPress("e", () => {
            if (isPlayerSittingRef.current) {
              isPlayerSittingRef.current = false;
              player.play(`idle-${player.direction}`);
            } else if (nearChairRef.current) {
              isPlayerSittingRef.current = true;
              player.play(`sit-${nearChairRef.current}`);
              player.direction = nearChairRef.current;
            }
          });
          
          if (dx !== 0 && dy !== 0) {
            dx *= Math.SQRT1_2;
            dy *= Math.SQRT1_2;
          }
          
          if (moving) {
            player.move(dx * PLAYER_SPEED * k.dt(), dy * PLAYER_SPEED * k.dt());
            if (!player.isMoving || player.direction !== newDir) {
              player.play(`run-${newDir}`);
              player.isMoving = true;
              player.direction = newDir;
            }
          } else if (player.isMoving) {
            player.play(`idle-${player.direction}`);
            player.isMoving = false;
          }
          
          const shouldSendUpdate =
          currentTime - lastUpdateRef.current >= UPDATE_INTERVAL ||
          player.isMoving !== prevMovingRef.current ||
          player.direction !== prevDirectionRef.current;
          
          if (shouldSendUpdate) {
            WebSocketService.sendMovementUpdate({
              x: player.pos.x,
              y: player.pos.y,
              direction: player.direction,
              isMoving: player.isMoving,
            });
            lastUpdateRef.current = currentTime;
            prevMovingRef.current = player.isMoving;
            prevDirectionRef.current = player.direction;
          }
          
          const playerNameTag = playerNameTagRef.current;
          if (playerNameTag) {
            playerNameTag.pos.x = player.pos.x;
            playerNameTag.pos.y = player.pos.y - 20;
          }
          
          Object.values(otherPlayers.current).forEach((op) => {
            const sprite = op.sprite;
            const elapsed = currentTime - op.lastUpdate;
            const lerpFactor = Math.min(elapsed / INTERPOLATION_DELAY, 1);
            sprite.pos.x = k.lerp(op.previousX, sprite.targetX, lerpFactor);
            sprite.pos.y = k.lerp(op.previousY, sprite.targetY, lerpFactor);
            
            if (op.nameTag) {
              op.nameTag.pos.x = sprite.pos.x;
              op.nameTag.pos.y = sprite.pos.y - 20;
            }
          });
          
          const currentCamPos = k.camPos();
          const targetCamPos = player.pos;
          const smoothSpeed = 0.1;
          k.camPos(
            k.lerp(currentCamPos.x, targetCamPos.x, smoothSpeed),
            k.lerp(currentCamPos.y, targetCamPos.y, smoothSpeed)
          );
        }
      
      // );
    );
      } catch (err) {
        console.error("Error loading map:", err);
      }
    };
    
    cancelHandlers.push(
      k.onKeyPress("e", () => {
        const player = playerRef.current;
        if (!player) return;
        if (isPlayerSittingRef.current) {
          isPlayerSittingRef.current = false;
          player.play(`idle-${player.direction}`);
        } else if (nearChairRef.current) {
          isPlayerSittingRef.current = true;
          player.play(`sit-${nearChairRef.current}`);
          player.direction = nearChairRef.current;
        }
      })
    );

    startGame();

    WebSocketService.setOnPlayerUpdate((players: Record<string, RemotePlayerData>) => {
      console.log("Received player updates:", players);
      const currentTime = Date.now();

      const myId = WebSocketService.getCurrentPlayerId();
      const me = players[myId];
      if (me && !didCreateLocalSpriteRef.current && gameRef.current) {
        console.log("Spawning local player from server coords:", me.x, me.y);

        const localSprite = trackedAdd([
          k.sprite("player"),
          k.pos(me.x, me.y),
          k.area(),
          k.anchor("center"),
          k.body(),
          {
            speed: PLAYER_SPEED,
            isMoving: me.isMoving || false,
            direction: me.direction || "down",
          },
        ]);

        //         const localSprite = k.add([
        //   k.sprite("player"),
        //   k.pos(me.x, me.y),
        //   k.area(),
        //   k.anchor("center"),
        //   k.body(),
        //   {
        //     speed: PLAYER_SPEED,
        //     isMoving: me.isMoving || false,
        //     direction: me.direction || "down",
        //   },
        // ]);
        localSprite.play(
          me.isMoving ? `run-${me.direction || "down"}` : `idle-${me.direction || "down"}`
        );
        playerRef.current = localSprite;

        const localNameTag = trackedAdd([
          k.text(playerName, {
            size: 16,
          }),
          k.pos(me.x, me.y - 20),
          k.anchor("center"),
          k.color(255, 255, 255),
        ]);

        //         const localNameTag = k.add([
        //   k.text(playerName, {
        //     size: 16,
        //   }),
        //   k.pos(me.x, me.y - 20),
        //   k.anchor("center"),
        //   k.color(255, 255, 255),
        // ]);
        playerNameTagRef.current = localNameTag;

        didCreateLocalSpriteRef.current = true;
      }

      Object.entries(players).forEach(([id, pData]) => {
        if (id !== myId) {
          if (!otherPlayers.current[id]) {
            // const spr = k.add([
            const spr = trackedAdd([
              k.sprite("player"),
              k.pos(pData.x, pData.y),
              k.area(),
              k.anchor("center"),
              {
                id,
                username: pData.username,
                isMoving: pData.isMoving,
                direction: pData.direction || "down",
                targetX: pData.x,
                targetY: pData.y,
                previousX: pData.x,
                previousY: pData.y,
                lastUpdate: currentTime,
                currentAnim: pData.isMoving
                  ? `run-${pData.direction || "down"}`
                  : `idle-${pData.direction || "down"}`,
              },
            ]);
            spr.play(
              pData.isMoving
                ? `run-${pData.direction || "down"}`
                : `idle-${pData.direction || "down"}`
            );

            const nameTag = k.add([
              k.text(pData.username || "Unknown", {
                size: 16,
              }),
              k.pos(pData.x, pData.y - 20),
              k.anchor("center"),
              k.color(255, 255, 255),
            ]);

            otherPlayers.current[id] = {
              sprite: spr,
              nameTag,
              lastUpdate: currentTime,
              previousX: pData.x,
              previousY: pData.y,
              currentAnim: pData.isMoving
                ? `run-${pData.direction || "down"}`
                : `idle-${pData.direction || "down"}`,
            };
          } else {
            const op = otherPlayers.current[id];
            if (op && op.sprite) {
              op.previousX = op.sprite.pos.x;
              op.previousY = op.sprite.pos.y;
              op.sprite.targetX = pData.x;
              op.sprite.targetY = pData.y;
              op.lastUpdate = currentTime;

              const targetAnim = pData.isMoving
                ? `run-${pData.direction || "down"}`
                : `idle-${pData.direction || "down"}`;
              if (op.currentAnim !== targetAnim) {
                op.sprite.play(targetAnim);
                op.currentAnim = targetAnim;
              }
            }
          }
        }
      });

      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }
      cleanupTimeoutRef.current = setTimeout(() => {
        Object.keys(otherPlayers.current).forEach((pid) => {
          if (!players[pid]) {
            console.log("Removing disconnected player:", pid);
            const pObj = otherPlayers.current[pid];
            if (pObj) {
              if (pObj.sprite && typeof pObj.sprite.destroy === "function") {
                pObj.sprite.destroy();
              }
              if (pObj.nameTag && typeof pObj.nameTag.destroy === "function") {
                pObj.nameTag.destroy();
              }
              delete otherPlayers.current[pid];
            }
          }
        });
        cleanupTimeoutRef.current = null;
      }, CLEANUP_DELAY);
    });

    WebSocketService.connect(
      playerName,
      () => {
        console.log("Connected to game server");
        if (roomId) {
          WebSocketService.joinRoom(roomId)
            .then(() => {
              console.log("Joined room:", roomId);
            })
            .catch((err: unknown) => console.error("Failed to join room:", err));
        } else {
          WebSocketService.createRoom()
            .then((newRoomId: string) => {
              console.log("Created room:", newRoomId);
            })
            .catch((err: unknown) => console.error("Failed to create room:", err));
        }
      },
      (err: unknown) => console.error("Failed to connect:", err)
    );

    return () => {
      console.log("Unmounting GameCanvas");
      if (activeCallRef.current) {
        leaveVideo();
        activeCallRef.current = false;
      }
      if (WebSocketService.isConnected()) {
        WebSocketService.disconnect();
      }

      cancelHandlers.forEach((h) => h.cancel());
    spawnedObjects.forEach((o) => o?.destroy?.());
    Object.values(otherPlayers.current).forEach((op) => {
      op.sprite?.destroy();
      op.nameTag?.destroy();
    });
    otherPlayers.current = {};
    playerRef.current = null;
    playerNameTagRef.current = null;
    didCreateLocalSpriteRef.current = false;

      // if (gameRef.current) {
      //   try {
      //     gameRef.current.quit();
      //     // destroy(k);
      //   } catch (destroyErr) {
      //     console.error("Error quitting Kaboom:", destroyErr);
      //   }
      // }
    };
  }, [playerName, roomId]);

  const openChat = () => setIsChatOpen(true);
  const closeChat = () => setIsChatOpen(false);

  const handleToggleCamera = async () => {
    const result = await toggleCamera();
    setIsCameraOn(result.isOn);
  };

  const handleToggleMic = async () => {
    const result = await toggleMic();
    setIsMicOn(result.isOn);
  };

  const handleToggleScreenShare = async () => {
    const result = await toggleScreenShare(process.env.NEXT_PUBLIC_AGORA_APP_ID, roomId);
    setIsScreenSharing(result.isScreenSharing);
  };

  const handleLeaveRoom = () => {
    WebSocketService.leaveRoom();
    window.location.href = "/office";
  };

  useEffect(() => {
    const remoteEl = document.getElementById("remote-videos");
    if (!remoteEl) return;

    const handleRemoteClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const container = target?.closest(".remote-video-container") as HTMLElement | null;
      if (!container) return;

      const uid = container.id.replace("remote-", "");
      if (uid) {
        setZoomUid(uid);
      }
    };

    remoteEl.addEventListener("click", handleRemoteClick);
    return () => {
      remoteEl.removeEventListener("click", handleRemoteClick);
    };
  }, []);

  return (
    <div className={styles.gameCanvasContainer}>
      <canvas ref={canvasRef} id="game" className={styles.gameCanvas} />

      <div className={styles.videoCallsContainer}>
        <div
          id="local-video"
          className={styles.localVideo}
          style={{ display: isVideoVisible ? "block" : "none" }}
        />

        <div id="remote-videos" className={styles.remoteVideos}>
          {remoteStreams.map((stream) => (
            <div
              key={stream.id}
              id={`remote-video-${stream.id}`}
              className={styles.remoteVideo}
            >
              <video
                ref={(video) => {
                  if (video) {
                    stream.play(video);
                  }
                }}
                autoPlay
                playsInline
                muted
              />
            </div>
          ))}
        </div>
      </div>

      <div
        id="screen-video"
        className={styles.screenVideo}
        style={{ display: isScreenSharing ? "block" : "none" }}
      />

      {isChatOpen ? (
        <div className={styles.chatBoxContainer}>
          <Chatbox roomId={roomId} playerName={playerName} onClose={closeChat} />
        </div>
      ) : (
        <button
          className={styles.chatToggleButton}
          onClick={openChat}
          aria-label="Open Chat"
        >
          <FaComments size={24} />
        </button>
      )}

      <div className={styles.mediaControlsContainer}>
        <button
          className={styles.mediaButton}
          onClick={handleToggleCamera}
          aria-label={isCameraOn ? "Turn Off Camera" : "Turn On Camera"}
        >
          {isCameraOn ? <FaVideo size={24} /> : <FaVideoSlash size={24} />}
        </button>

        <button
          className={styles.mediaButton}
          onClick={handleToggleMic}
          aria-label={isMicOn ? "Mute Microphone" : "Unmute Microphone"}
        >
          {isMicOn ? <FaMicrophone size={24} /> : <FaMicrophoneSlash size={24} />}
        </button>

        <button
          className={styles.mediaButton}
          onClick={handleToggleScreenShare}
          aria-label={isScreenSharing ? "Stop Screen Sharing" : "Share Screen"}
        >
          {isScreenSharing ? <FaDesktop size={24} /> : <FaDesktop size={24} />}
        </button>

        <button
          className={styles.mediaButton}
          onClick={openDiscord}
          aria-label="Open Discord"
        >
          <FaDiscord size={24} />
        </button>

        <button
          className={styles.mediaButton}
          onClick={handleLeaveRoom}
          aria-label="Leave Room"
        >
          <FaDoorOpen size={24} />
        </button>
      </div>

      {isDiscordOpen && (
        <DiscordDialog selectedChannel={selectedDiscordChannel} onClose={closeDiscord} />
      )}

      {zoomUid && <RemoteVideoModal uid={zoomUid} onClose={() => setZoomUid(null)} />}
    </div>
  );
}

export default GameCanvas;
