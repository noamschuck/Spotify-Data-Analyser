import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { importHistoryFiles, clearHistory, formatMs } from '../spotify/history';
import { useHistory } from '../context/HistoryContext';

export function History() {
  const { stats, loading, refresh } = useHistory();
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const jsonFiles = [...files].filter((f) => f.name.endsWith('.json'));
    if (jsonFiles.length === 0) {
      setError('Please select your Spotify Streaming_History_Audio_*.json files.');
      return;
    }
    setError(null);
    setImporting(true);
    setProgress(0);
    try {
      await importHistoryFiles(jsonFiles, setProgress);
      refresh();
    } catch (e) {
      setError(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setImporting(false);
    }
  }

  async function handleClear() {
    await clearHistory();
    refresh();
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-violet-400">
        Loading history...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-violet-200">Listening History</h1>
        {stats && (
          <button
            onClick={handleClear}
            className="text-xs text-red-400 hover:text-red-300 transition-colors cursor-pointer"
          >
            Clear imported data
          </button>
        )}
      </div>
      <p className="text-sm text-[#6b6590] mb-6">
        Import your Spotify Extended Streaming History to see real play counts and listening time.
      </p>

      {/* Import zone */}
      {!stats && (
        <div className="space-y-6">
          <div
            className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors cursor-pointer ${
              dragOver
                ? 'border-violet-500 bg-[#1f1d33]'
                : 'border-[#3e3b5e] hover:border-violet-500 hover:bg-[#1f1d33]/50'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              void handleFiles(e.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
          >
            <div className="text-4xl mb-3">📂</div>
            <p className="font-semibold text-violet-300 mb-1">
              Drop your Streaming History files here
            </p>
            <p className="text-sm text-[#6b6590]">
              or click to browse — select all <code className="bg-[#262340] px-1 rounded text-violet-300">Streaming_History_Audio_*.json</code> files
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".json"
              multiple
              className="hidden"
              onChange={(e) => void handleFiles(e.target.files)}
            />
          </div>

          {importing && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-[#8a85ad]">
                <span>Importing...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-[#262340] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-400 to-blue-400 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="bg-[#1f1d33] rounded-2xl p-5 border border-[#2e2b46]">
            <p className="text-sm font-semibold text-violet-300 mb-2">How to get your data from Spotify:</p>
            <ol className="text-sm text-[#a09bc0] space-y-1 list-decimal list-inside leading-relaxed">
              <li>Go to your Spotify account page → <strong>Privacy Settings</strong></li>
              <li>Scroll to <strong>Download your data</strong> and request <strong>Extended Streaming History</strong></li>
              <li>Spotify emails you when it's ready (usually 3–5 days)</li>
              <li>Download the ZIP, extract it, and import all <code className="bg-[#18162a] px-1 rounded">Streaming_History_Audio_*.json</code> files here</li>
            </ol>
            <p className="text-xs text-[#6b6590] mt-3">
              Your data stays in your browser — nothing is uploaded anywhere.
            </p>
          </div>
        </div>
      )}

      {/* Stats dashboard */}
      {stats && (
        <div className="space-y-6">
          {/* Re-import button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => inputRef.current?.click()}
              className="text-xs bg-[#262340] text-violet-300 hover:bg-[#1f1d33] px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              + Import more files
            </button>
            <p className="text-xs text-[#6b6590]">
              Imported {new Date(stats.importedAt).toLocaleDateString()} · {stats.entryCount.toLocaleString()} raw entries
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".json"
              multiple
              className="hidden"
              onChange={(e) => void handleFiles(e.target.files)}
            />
          </div>

          {importing && (
            <div className="space-y-2">
              <div className="h-2 bg-[#262340] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-400 to-blue-400 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard emoji="▶️" label="Total Streams" value={stats.totalStreams.toLocaleString()} />
            <SummaryCard emoji="⏱️" label="Time Listened" value={formatMs(stats.totalMsPlayed)} />
            <SummaryCard emoji="🎵" label="Unique Tracks" value={(stats.uniqueTrackCount ?? stats.topTracks.length).toLocaleString()} />
            <SummaryCard emoji="🎤" label="Unique Artists" value={(stats.uniqueArtistCount ?? stats.topArtists.length).toLocaleString()} />
          </div>

          {/* Listening over time chart */}
          {stats.monthly.length > 1 && (
            <div className="bg-[#18162a] rounded-2xl p-6 shadow-sm shadow-black border border-[#2e2b46]">
              <h3 className="font-semibold text-violet-300 mb-4">Streams Over Time</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={stats.monthly} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="streamGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10, fill: '#6b6590' }}
                    tickFormatter={(v: string) => v.slice(0, 7)}
                    interval="preserveStartEnd"
                  />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{
                      background: '#18162a',
                      border: '1px solid #3e3b5e',
                      borderRadius: 8,
                      fontSize: 12,
                      color: '#ede9f9',
                    }}
                    formatter={(v: number) => [v.toLocaleString(), 'Streams']}
                    labelFormatter={(l: string) => l}
                  />
                  <Area
                    type="monotone"
                    dataKey="streams"
                    stroke="#a78bfa"
                    strokeWidth={2}
                    fill="url(#streamGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top tracks */}
          <div className="bg-[#18162a] rounded-2xl shadow-sm shadow-black border border-[#2e2b46] overflow-hidden">
            <div className="p-4 pb-2">
              <h3 className="font-semibold text-violet-300">Most Played Tracks</h3>
              <p className="text-xs text-[#6b6590]">Streams where you listened for 30+ seconds</p>
            </div>
            <div className="divide-y divide-[#2e2b46]">
              {stats.topTracks.slice(0, 50).map((t, i) => (
                <div key={t.trackId} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-sm font-bold text-violet-200 w-6 text-right shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <Link to={`/search?type=track&id=${t.trackId}`} className="text-sm font-medium text-[#ede9f9] hover:text-violet-300 truncate block">{t.trackName}</Link>
                    <Link to={`/search?q=${encodeURIComponent(t.artistName)}`} className="text-xs text-[#6b6590] hover:text-violet-400 truncate block">{t.artistName}</Link>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-violet-400">{t.streams}×</p>
                    <p className="text-xs text-[#6b6590]">{formatMs(t.msPlayed)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top artists */}
          <div className="bg-[#18162a] rounded-2xl shadow-sm shadow-black border border-[#2e2b46] overflow-hidden">
            <div className="p-4 pb-2">
              <h3 className="font-semibold text-violet-300">Most Played Artists</h3>
            </div>
            <div className="divide-y divide-[#2e2b46]">
              {stats.topArtists.slice(0, 25).map((a, i) => (
                <div key={a.artistName} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-sm font-bold text-violet-200 w-6 text-right shrink-0">{i + 1}</span>
                  <Link to={`/search?q=${encodeURIComponent(a.artistName)}`} className="flex-1 text-sm font-medium text-[#ede9f9] hover:text-violet-300 truncate">{a.artistName}</Link>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-violet-400">{a.streams.toLocaleString()}×</p>
                    <p className="text-xs text-[#6b6590]">{formatMs(a.msPlayed)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <div className="bg-[#18162a] rounded-2xl p-4 shadow-sm shadow-black border border-[#2e2b46]">
      <div className="text-2xl mb-2">{emoji}</div>
      <p className="text-xs text-violet-400 font-medium mb-0.5">{label}</p>
      <p className="text-xl font-bold text-violet-200">{value}</p>
    </div>
  );
}
