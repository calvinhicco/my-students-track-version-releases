"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { AlertCircle, CheckCircle, HardDriveDownload, HardDriveUpload, RefreshCw, Usb } from "lucide-react";
import BackupManager, { BackupMetadata } from "../lib/backupManager";

interface BackupRestorePageProps {
  onBack: () => void;
}

export default function BackupRestorePage({ onBack }: BackupRestorePageProps) {
  const backupManagerRef = useRef<BackupManager>();
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [lastBackup, setLastBackup] = useState<BackupMetadata | null>(null);
  const [lastRestoreDate, setLastRestoreDate] = useState<string | null>(null);
  const [usbDrives, setUsbDrives] = useState<string[]>([]);

  useEffect(() => {
    backupManagerRef.current = new BackupManager("Dashboard User");

    // load last restore date from localStorage
    const lr = localStorage.getItem("studentTrackLastRestore");
    if (lr) setLastRestoreDate(lr);

    // fetch last backup metadata
    const historyJson = localStorage.getItem("backupHistory");
    if (historyJson) {
      try {
        const history: BackupMetadata[] = JSON.parse(historyJson);
        if (history.length > 0) setLastBackup(history[0]);
      } catch {
        // ignore
      }
    }

    // get USB drives
    if (typeof window !== "undefined" && (window as any).electronAPI?.getRemovableDrives) {
      (window as any).electronAPI
        .getRemovableDrives()
        .then((res: { success: boolean; drives: string[] }) => {
          if (res.success && Array.isArray(res.drives)) {
            setUsbDrives(res.drives);
          }
        })
        .catch(() => {});
    }
    const handleAutoBackup = async () => {
      if (!backupManagerRef.current) return;
      const today = new Date();
      const lastBackupDate = localStorage.getItem("lastAutoBackupDate");

      if (lastBackupDate) {
        const lastDate = new Date(lastBackupDate);
        if (
          lastDate.getFullYear() === today.getFullYear() &&
          lastDate.getMonth() === today.getMonth()
        ) {
          return; // Backup for this month already exists
        }
      }

      if (today.getDate() === 1) {
        setCreatingBackup(true);
        setStatusMessage("Creating monthly auto-backup...");
        const name = `Auto Backup - ${today.toLocaleDateString()}`;
        const result = await backupManagerRef.current.createBackup(name, undefined, false);
        if (result.success && result.backupId) {
          const exportRes = await backupManagerRef.current.exportBackup(result.backupId);
          if (exportRes.success && exportRes.data) {
            const fileName = "localData.json";
            if ((window as any).electronAPI?.saveDataBackup) {
              await (window as any).electronAPI.saveDataBackup(exportRes.data, fileName, true);
            }
            setStatusMessage("Auto-backup saved successfully.");
            localStorage.setItem("lastAutoBackupDate", today.toISOString());
            // refresh last backup info
            setLastBackup(backupManagerRef.current["backupHistory"][0]);
          } else {
            setStatusMessage("Failed to export auto-backup.");
          }
        } else {
          setStatusMessage("Failed to create auto-backup: " + (result.error || ""));
        }
        setCreatingBackup(false);
      }
    };

    handleAutoBackup();
  }, []);

  const handleCreateBackup = async (saveToUsb?: string) => {
    if (!backupManagerRef.current) return;
    setCreatingBackup(true);
    setStatusMessage("Creating backup...");
    const name = `Manual Backup - ${new Date().toLocaleDateString()}`;
    const result = await backupManagerRef.current.createBackup(name, undefined, false);
    if (result.success && result.backupId) {
      const exportRes = await backupManagerRef.current.exportBackup(result.backupId);
      if (exportRes.success && exportRes.data) {
        const fileName = exportRes.filename || `StudentTrackBackup_${result.backupId}.json`;
        const defaultFileName = saveToUsb ? `${saveToUsb}${fileName}` : fileName;
        if ((window as any).electronAPI?.saveDataBackup) {
          await (window as any).electronAPI.saveDataBackup(exportRes.data, defaultFileName);
        }
        setStatusMessage("Backup saved successfully.");
        // refresh last backup info
        setLastBackup(backupManagerRef.current["backupHistory"][0]);
      } else {
        setStatusMessage("Failed to export backup.");
      }
    } else {
      setStatusMessage("Failed to create backup: " + (result.error || ""));
    }
    setCreatingBackup(false);
  };

  const handleRestoreBackup = async () => {
    if (!backupManagerRef.current) return;
    setRestoringBackup(true);
    setStatusMessage("Selecting backup file to restore...");
    try {
      const res = await (window as any).electronAPI?.loadDataBackup();
      if (res?.success && res.data) {
        const importJson = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
        const importRes = await backupManagerRef.current.importBackup(importJson);
        if (importRes.success && importRes.backupId) {
          // Now actually restore data
          const restoreRes = await backupManagerRef.current.restoreFromBackup(importRes.backupId, {
            restoreStudents: true,
            restoreTransferred: true,
            restoreSettings: true,
            createBackupBeforeRestore: true,
          });
          if (restoreRes.success) {
            const nowIso = new Date().toISOString();
            localStorage.setItem("studentTrackLastRestore", nowIso);
            setLastRestoreDate(nowIso);
            setStatusMessage("Data restored successfully. Application will reload to apply new settings.");
              if (restoreRes.settingsRestored) {
                const confirmRestart = window.confirm(
                  "Settings were restored and require an application restart to take effect. Restart now?",
                );
                if (confirmRestart) {
                  window.location.reload();
                }
              }
          } else {
            setStatusMessage("Restore completed with errors: " + restoreRes.errors.join(", "));
          }
        } else {
          setStatusMessage("Import failed: " + (importRes.error || ""));
        }
      } else {
        setStatusMessage("Restore cancelled or failed.");
      }
    } catch (error: any) {
      setStatusMessage("Error during restore: " + error.message);
    }
    setRestoringBackup(false);
  };

  return (
    <div className="min-h-screen bg-purple-50">
      <div className="bg-white shadow-sm border-b p-4 flex items-center gap-4">
        <Button variant="outline" onClick={onBack} className="text-purple-600 border-purple-600 hover:bg-purple-50">
          ← Back to Dashboard
        </Button>
        <h1 className="text-xl font-semibold text-purple-800">Backup & Restore</h1>
      </div>

      <div className="p-6 space-y-6 max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-800">
              <HardDriveDownload className="w-5 h-5" /> Create Backup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {lastBackup && (
              <p className="text-sm text-gray-600">
                Last Backup: {new Date(lastBackup.createdAt).toLocaleString()} ({lastBackup.name})
              </p>
            )}
            <div className="flex gap-4 flex-wrap">
              <Button onClick={() => handleCreateBackup()} disabled={creatingBackup} className="bg-purple-600 hover:bg-purple-700">
                <HardDriveDownload className="w-4 h-4 mr-2" /> Save to Computer
              </Button>
              {usbDrives.map((drive) => (
                <Button
                  key={drive}
                  onClick={() => handleCreateBackup(drive)}
                  disabled={creatingBackup}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Usb className="w-4 h-4" /> Save to {drive}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-800">
              <HardDriveUpload className="w-5 h-5" /> Restore Backup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {lastRestoreDate && (
              <p className="text-sm text-gray-600">Last Restore: {new Date(lastRestoreDate).toLocaleString()}</p>
            )}
            <Button onClick={handleRestoreBackup} disabled={restoringBackup} className="bg-green-600 hover:bg-green-700">
              <RefreshCw className="w-4 h-4 mr-2" /> Select Backup File & Restore
            </Button>
          </CardContent>
        </Card>

        {statusMessage && (
          <div className="flex items-center gap-2 text-sm">
            {statusMessage.startsWith("Error") || statusMessage.includes("failed") ? (
              <AlertCircle className="w-4 h-4 text-red-600" />
            ) : (
              <CheckCircle className="w-4 h-4 text-green-600" />
            )}
            <span>{statusMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
}
