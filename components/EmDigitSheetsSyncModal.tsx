import React, { useCallback, useMemo, useState } from 'react';
import { InventoryItem, Stock } from '../types';
import { XMarkIcon } from './icons/XMarkIcon';
import { ArrowRightLeftIcon } from './icons/ArrowRightLeftIcon';
import {
  clearGoogleAccessToken,
  getCachedGoogleAccessToken,
  getGoogleClientId,
  requestGoogleSheetsAccessToken,
} from '../utils/googleSheetsAuth';
import {
  getEmDigitSheetId,
  pullEmDigitInventoryFromSheet,
  pushEmDigitInventoryToSheet,
} from '../utils/emDigitSheetsSync';

interface EmDigitSheetsSyncModalProps {
  onClose: () => void;
  items: InventoryItem[];
  stock: Stock[];
  /** Merge master fields into Firestore without touching stock */
  onPull: (items: InventoryItem[]) => Promise<void>;
}

type SyncStatus = 'idle' | 'connecting' | 'pulling' | 'pushing' | 'success' | 'error';

const formatTime = (iso: string | null): string => {
  if (!iso) return 'Never';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

const EmDigitSheetsSyncModal: React.FC<EmDigitSheetsSyncModalProps> = ({
  onClose,
  items,
  stock,
  onPull,
}) => {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(() => {
    try {
      return localStorage.getItem('emDigitLastSyncAt');
    } catch {
      return null;
    }
  });
  const [connected, setConnected] = useState(() => Boolean(getCachedGoogleAccessToken()));

  const sheetId = useMemo(() => {
    try {
      return getEmDigitSheetId();
    } catch {
      return '(unavailable)';
    }
  }, []);

  const clientIdConfigured = useMemo(() => {
    try {
      getGoogleClientId();
      return true;
    } catch {
      return false;
    }
  }, []);

  const rememberSync = (iso: string) => {
    setLastSyncAt(iso);
    try {
      localStorage.setItem('emDigitLastSyncAt', iso);
    } catch {
      // ignore quota / private mode
    }
  };

  const ensureConnected = useCallback(async () => {
    setStatus('connecting');
    setError('');
    setMessage('Requesting Google Sheets access…');
    const token = await requestGoogleSheetsAccessToken();
    setConnected(true);
    setMessage('Connected to Google.');
    setStatus('idle');
    return token;
  }, []);

  const handleConnect = async () => {
    try {
      await ensureConnected();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to connect Google account.';
      setError(msg);
      setStatus('error');
      setMessage('');
    }
  };

  const handleDisconnect = () => {
    clearGoogleAccessToken();
    setConnected(false);
    setMessage('Cleared local Google token.');
    setError('');
    setStatus('idle');
  };

  const runPull = async () => {
    setStatus('pulling');
    setError('');
    setMessage('Pulling master fields from Google Sheet…');
    const token = getCachedGoogleAccessToken() || (await ensureConnected());
    const result = await pullEmDigitInventoryFromSheet({ accessToken: token });
    await onPull(result.items);
    const now = new Date().toISOString();
    rememberSync(now);
    const warnNote =
      result.mapped.warnings.length > 0
        ? ` (${result.mapped.warnings.length} row warning(s), ${result.mapped.skippedRows} skipped)`
        : '';
    setMessage(
      `Pulled ${result.items.length} item(s) into digitgit (stock unchanged).${warnNote}`,
    );
    setStatus('success');
    return result;
  };

  const runPush = async () => {
    setStatus('pushing');
    setError('');
    setMessage('Pushing floor stock to Google Sheet warehouse columns…');
    const token = getCachedGoogleAccessToken() || (await ensureConnected());
    const result = await pushEmDigitInventoryToSheet(items, stock, { accessToken: token });
    const now = new Date().toISOString();
    rememberSync(now);
    const warnNote =
      result.warnings.length > 0 ? ` ${result.warnings[0]}` : '';
    setMessage(
      `Pushed ${result.updatedCells} warehouse cell(s) for ${result.matchedItems} matched SKU(s).${warnNote}`,
    );
    setStatus('success');
    return result;
  };

  const handlePull = async () => {
    try {
      await runPull();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Pull failed.';
      setError(msg);
      setStatus('error');
      setMessage('');
    }
  };

  const handlePush = async () => {
    try {
      await runPush();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Push failed.';
      setError(msg);
      setStatus('error');
      setMessage('');
    }
  };

  const handleSyncBoth = async () => {
    try {
      await runPull();
      await runPush();
      setMessage('Sync complete: pulled master fields, then pushed floor stock.');
      setStatus('success');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Sync failed.';
      setError(msg);
      setStatus('error');
      setMessage('');
    }
  };

  const busy = status === 'connecting' || status === 'pulling' || status === 'pushing';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden animate-fade-in-down">
        <div className="bg-white p-6 text-black flex justify-between items-center border-b border-gray-100">
          <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-3 text-black">
            <ArrowRightLeftIcon className="w-6 h-6 text-em-red" />
            Sync EM Sheet
          </h2>
          <button
            onClick={onClose}
            className="bg-em-red text-white p-1 rounded-md hover:bg-red-700 transition-colors shadow-sm"
            disabled={busy}
          >
            <XMarkIcon className="w-6 h-6 text-white" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-sm text-gray-700 font-medium leading-relaxed">
            digitgit is the <span className="font-black">floor system of record</span> for warehouse
            counts. The <span className="font-black">app owns category</span> (and description /
            color). Pull only refreshes SAGE qty and 3-year average from the sheet (never stock or
            identity fields). Push writes C / K / J / Production Shelf quantities from Firebase
            into the sheet.
          </p>

          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs font-medium text-gray-700 space-y-1">
            <div>
              <span className="font-black uppercase tracking-wider text-gray-500">Sheet ID</span>{' '}
              <span className="font-mono break-all">{sheetId}</span>
            </div>
            <div>
              <span className="font-black uppercase tracking-wider text-gray-500">Google</span>{' '}
              {connected ? (
                <span className="text-emerald-700 font-bold">Connected</span>
              ) : (
                <span className="text-amber-700 font-bold">Not connected</span>
              )}
            </div>
            <div>
              <span className="font-black uppercase tracking-wider text-gray-500">Last sync</span>{' '}
              {formatTime(lastSyncAt)}
            </div>
            {!clientIdConfigured && (
              <div className="text-red-700 font-bold pt-1">
                Set VITE_GOOGLE_CLIENT_ID in .env.local before connecting.
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleConnect}
              disabled={busy || !clientIdConfigured}
              className="px-4 py-3 rounded-xl border-2 border-gray-200 text-xs font-black uppercase hover:border-em-red disabled:opacity-50"
            >
              Connect Google
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={busy || !connected}
              className="px-4 py-3 rounded-xl border-2 border-gray-200 text-xs font-black uppercase hover:border-gray-400 disabled:opacity-50"
            >
              Clear Token
            </button>
            <button
              type="button"
              onClick={handlePull}
              disabled={busy || !clientIdConfigured}
              className="px-4 py-3 rounded-xl bg-sky-600 text-white text-xs font-black uppercase shadow hover:bg-sky-700 disabled:opacity-50"
            >
              Pull (Sheet → App)
            </button>
            <button
              type="button"
              onClick={handlePush}
              disabled={busy || !clientIdConfigured}
              className="px-4 py-3 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase shadow hover:bg-emerald-700 disabled:opacity-50"
            >
              Push (App → Sheet)
            </button>
            <button
              type="button"
              onClick={handleSyncBoth}
              disabled={busy || !clientIdConfigured}
              className="col-span-2 px-4 py-3 rounded-xl bg-em-red text-white text-xs font-black uppercase shadow-lg hover:bg-red-700 disabled:opacity-50"
            >
              Sync Both (Pull then Push)
            </button>
          </div>

          {message && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-medium text-emerald-900">
              {busy && <span className="animate-pulse">… </span>}
              {message}
            </div>
          )}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm font-medium text-red-800 whitespace-pre-wrap">
              {error}
              <button
                type="button"
                className="block mt-2 text-[11px] font-black uppercase text-red-600 underline"
                onClick={() => setError('')}
              >
                Clear error
              </button>
            </div>
          )}

          <div className="text-[11px] text-gray-500 font-medium leading-relaxed">
            Mapping: <code className="font-mono">wh-c</code>→C WAREHOUSE,{' '}
            <code className="font-mono">wh-k</code>→K WAREHOUSE,{' '}
            <code className="font-mono">wh-j</code>→J WAREHOUSE,{' '}
            <code className="font-mono">prod</code>→PRODUCTION SHELF. SAGE headers that include a
            date (e.g. SAGE 06/19/2026) are supported.
          </div>
        </div>

        <div className="bg-gray-50 p-5 flex justify-end border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-6 py-3 text-xs font-black text-gray-700 hover:text-gray-900 uppercase disabled:opacity-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmDigitSheetsSyncModal;
