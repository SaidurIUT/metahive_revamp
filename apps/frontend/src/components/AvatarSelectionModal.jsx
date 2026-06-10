

function AvatarSelectionModal({ avatars, onSelect }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-zinc-950/95 p-8 shadow-2xl shadow-black/50">
        <div className="text-center">
          <h2 className="text-3xl font-semibold text-white">Choose Your Avatar</h2>
          <p className="mt-3 text-sm text-zinc-400">Pick an appearance before entering the office.</p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {avatars.map((avatar) => (
            <button
              key={avatar.id}
              type="button"
              onClick={() => onSelect(avatar.id)}
              className="group flex w-full flex-col overflow-hidden rounded-2xl border border-transparent bg-zinc-900 transition hover:-translate-y-1 hover:border-emerald-500/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/70"
            >
              <div className="h-40 w-full overflow-hidden bg-black">
                <img
                  src={avatar.src}
                  alt={avatar.label}
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="flex items-center justify-center bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition group-hover:bg-zinc-800">
                {avatar.label}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AvatarSelectionModal;
