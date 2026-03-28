export function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-10 h-10 rounded-full border-4 border-[#2e2b46] border-t-violet-500 animate-spin" />
      <p className="text-sm text-violet-400">{message}</p>
    </div>
  );
}
