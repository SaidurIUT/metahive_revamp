"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, notFound } from "next/navigation";
import { meetingService, Meeting } from "@/services/office/meetingService";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { format } from "date-fns";
import BanglishSpeechToText from "@/components/BanglishSpeechToText";
import { RAG_BASE_URL } from "@/services/ragConfig";

type TranscriptData = {
  original: string[];
  banglish: string[];
};

export default function MeetingDetailsPage() {
  const { meetId } = useParams() as { meetId: string };

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMeetingOpen, setIsMeetingOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptData>({
    original: [],
    banglish: [],
  });
  const zegoRef = useRef<any>(null);

  useEffect(() => {
    const fetchMeeting = async () => {
      setIsLoading(true);
      try {
        const data = await meetingService.getMeeting(meetId);
        setMeeting(data);
      } catch {
        setError("Failed to fetch meeting details");
      } finally {
        setIsLoading(false);
      }
    };
    fetchMeeting();
  }, [meetId]);

  useEffect(() => {
    if (!isMeetingOpen) return;
    const container = document.getElementById("meeting-container");
    if (!container) return;

    const startZego = async () => {
      const { ZegoUIKitPrebuilt } = await import("@zegocloud/zego-uikit-prebuilt");
      const appID = Number(process.env.NEXT_PUBLIC_ZEGO_APP_ID);
      const serverSecret = process.env.NEXT_PUBLIC_ZEGO_SERVER_SECRET ?? "";
      const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
        appID,
        serverSecret,
        meetId,
        Date.now().toString(),
        "720"
      );
      const zp = ZegoUIKitPrebuilt.create(kitToken);
      zegoRef.current = zp;
      zp.joinRoom({
        container,
        sharedLinks: [
          {
            name: "Shareable link",
            url: `${window.location.origin}${window.location.pathname}?roomID=${meetId}`,
          },
        ],
        scenario: { mode: ZegoUIKitPrebuilt.VideoConference },
        maxUsers: 10,
      });
    };

    startZego().catch(console.error);

    return () => {
      if (zegoRef.current) {
        zegoRef.current.destroy();
        zegoRef.current = null;
      }
    };
  }, [isMeetingOpen, meetId]);

  const handleStart = () => setIsMeetingOpen(true);
  const handleClose = () => {
    setIsMeetingOpen(false);
    setIsListening(false);
  };

  const handleTranscriptUpdate = (newT: TranscriptData) => {
    setTranscripts((prev) => ({
      original: [...prev.original, ...newT.original],
      banglish: [],
    }));
  };

  const handleSave = async (transcript: string) => {
    try {
      const res = await fetch(`${RAG_BASE_URL}/context/${meetId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: transcript }),
      });
      if (!res.ok) throw new Error("Save failed");
    } catch (err) {
      console.error("Error saving transcript:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }
  if (error) {
    return <div className="p-4 text-red-500 text-center">{error}</div>;
  }
  if (!meeting) {
    notFound();
    return null;
  }

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>{meeting.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            <strong>Date:</strong>{" "}
            {format(new Date(meeting.meetingDate), "MMMM dd, yyyy HH:mm")}
          </p>
          <p className="mt-2">
            <strong>Description:</strong> {meeting.description}
          </p>
          {meeting.summary && (
            <p className="mt-2">
              <strong>Summary:</strong> {meeting.summary}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        {!isMeetingOpen ? (
          <button
            onClick={handleStart}
            className="bg-blue-500 text-white px-6 py-3 rounded-lg mb-4 hover:bg-blue-600 transition-colors"
          >
            Start Meeting
          </button>
        ) : (
          <>
            <div
              id="meeting-container"
              className="w-full max-w-4xl h-[60vh] bg-black rounded-lg mb-4"
            />
            <button
              onClick={handleClose}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors"
            >
              Close Meeting
            </button>
          </>
        )}

        <div className="w-full max-w-4xl mt-8 bg-white dark:bg-gray-800 p-4 rounded shadow">
          <h2 className="text-xl font-bold mb-4">Speech-to-Text</h2>
          <BanglishSpeechToText
            isListening={isListening}
            onTranscriptUpdate={handleTranscriptUpdate}
            onCallEnd={handleSave}
          />
          <div className="mt-4">
            {!isListening ? (
              <button
                onClick={() => setIsListening(true)}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors"
              >
                Start Transcription
              </button>
            ) : (
              <button
                onClick={() => setIsListening(false)}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors"
              >
                Stop Transcription
              </button>
            )}
          </div>

          <div className="mt-4">
            <h3 className="font-semibold">Transcript</h3>
            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded">
              {transcripts.original.map((t, i) => (
                <p key={i}>{t}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
