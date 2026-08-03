"use client";

import React, { useState, useMemo, useRef } from "react";
import { useFinOps } from "@/components/finops-provider";
import { useTheme } from "@/components/theme-provider";
import { Document } from "@/lib/seeds";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import {
  FolderArchive,
  Search,
  UploadCloud,
  Download,
  Trash2,
  Filter,
  Eye,
} from "lucide-react";

export default function DocumentStorePage() {
  const { documents, uploadDocument, deleteDocument } =
    useFinOps();
  const { cardRadius, buttonRadius, accentBg, accentText, accentBadge } =
    useTheme();

  const [searchQuery, setSearchQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("All");

  const [deleteReason, setDeleteReason] = useState("");
  const [activeDeleteId, setActiveDeleteId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [tag, setTag] = useState<Document["tag"]>("invoice");
  const [uploading, setUploading] = useState(false);

  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch =
        doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTag = tagFilter === "All" || doc.tag === tagFilter;
      return matchesSearch && matchesTag;
    });
  }, [documents, searchQuery, tagFilter]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    await uploadDocument(selectedFile, tag, displayName || undefined);
    setUploading(false);

    setSelectedFile(null);
    setDisplayName("");
    setTag("invoice");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleView = async (doc: Document) => {
    if (!doc.storage_path) {
      alert("No stored file path for this document.");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const { data, error } = await supabase.storage
      .from("finops-documents")
      .createSignedUrl(doc.storage_path, 60);
    if (error || !data) {
      alert(`Failed to open file: ${error?.message ?? "unknown error"}`);
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const handleDeleteTrigger = (id: string) => {
    setActiveDeleteId(id);
    setDeleteReason("");
  };

  const confirmDelete = () => {
    if (activeDeleteId && deleteReason.trim()) {
      deleteDocument(activeDeleteId, deleteReason);
      setActiveDeleteId(null);
      setDeleteReason("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-zinc-200 dark:border-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <h1 className="text-base font-bold font-mono uppercase tracking-wider">
            Document Store Repository
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs">
            Centralized, index-searched archive managing tax certificates,
            vendor invoices, bank statement spreadsheets, and payslips.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-[11px]">
        {/* Document Explorer (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Search */}
            <div className="flex items-center gap-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 px-2.5 py-1.5">
              <Search className="h-4 w-4 text-zinc-400 shrink-0" />
              <input
                type="text"
                placeholder="Search archive file names..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none text-[11px] focus:outline-none w-full"
              />
            </div>

            {/* Tag Filter */}
            <div className="flex items-center gap-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 px-2.5 py-1.5 text-[11px] font-mono">
              <Filter className="h-3.5 w-3.5 text-zinc-400" />
              <span className="text-zinc-400">Tag:</span>
              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="bg-transparent border-none w-full focus:outline-none"
              >
                <option value="All">All Categories</option>
                <option value="invoice">Invoices</option>
                <option value="po">Purchase Orders</option>
                <option value="bank statement">Bank Statements</option>
                <option value="payroll">Payroll Sheets</option>
                <option value="wht certificate">WHT Certificates</option>
              </select>
            </div>
          </div>

          {/* Files grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredDocs.map((doc) => (
              <div
                key={doc.id}
                className={`p-4 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 flex flex-col justify-between h-36 ${cardRadius}`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] text-zinc-400 font-bold uppercase">
                      {doc.tag}
                    </span>
                    <span className="text-[9px] font-mono text-zinc-400">
                      {doc.size}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate max-w-xs">
                      {doc.name}
                    </h3>
                    <p className="text-[9px] text-zinc-400 font-mono mt-0.5">
                      Uploaded by {doc.uploaded_by} — {doc.uploaded_at}
                    </p>
                  </div>
                </div>

                {/* Actions panel / Delete confirmation */}
                {activeDeleteId === doc.id ? (
                  <div className="space-y-1.5 pt-1.5 border-t dark:border-zinc-900 mt-1">
                    <input
                      type="text"
                      placeholder="Declassification audit reason..."
                      value={deleteReason}
                      onChange={(e) => setDeleteReason(e.target.value)}
                      className={`w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-1.5 py-0.5 text-[9px] font-mono focus:outline-none ${buttonRadius}`}
                    />
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => setActiveDeleteId(null)}
                        className="px-2 py-0.5 border border-zinc-200 dark:border-zinc-850 text-zinc-500 text-[8px] font-mono uppercase"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={confirmDelete}
                        disabled={!deleteReason.trim()}
                        className="px-2 py-0.5 bg-rose-600 disabled:opacity-50 text-white text-[8px] font-mono uppercase"
                      >
                        Confirm
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 flex justify-end gap-1 border-t border-zinc-100 dark:border-zinc-900/60">
                    <button
                      onClick={() => handleView(doc)}
                      className={`p-1 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 ${buttonRadius}`}
                    >
                      <Eye className="h-3.5 w-3.5 text-zinc-400" />
                    </button>
                    <button
                      onClick={() => handleView(doc)}
                      className={`p-1 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 ${buttonRadius}`}
                    >
                      <Download className="h-3.5 w-3.5 text-zinc-400" />
                    </button>
                    <button
                      onClick={() => handleDeleteTrigger(doc.id)}
                      className={`p-1 border border-rose-100 dark:border-rose-950/40 hover:bg-rose-50 dark:hover:bg-rose-950/20 ${buttonRadius}`}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Upload Form sidebar (1 col) */}
        <div className="space-y-6">
          <form
            onSubmit={handleUpload}
            className={`p-5 border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 space-y-4 ${cardRadius}`}
          >
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold border-b border-zinc-150 dark:border-zinc-900 pb-2">
              Index Document
            </h3>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase block">
                  Select File
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  className={`w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-zinc-400 ${buttonRadius}`}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase block">
                  Document Display Name (optional)
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={selectedFile?.name || "e.g. June_VAT_Filing_KRA_TIMS.pdf"}
                  className={`w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-400 ${buttonRadius}`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase block">
                  File Category Tag
                </label>
                <select
                  value={tag}
                  onChange={(e) => setTag(e.target.value as Document["tag"])}
                  className={`w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-400 ${buttonRadius}`}
                >
                  <option value="invoice">Invoice PDF</option>
                  <option value="po">Purchase Order</option>
                  <option value="bank statement">
                    Bank Statement Spreadsheets
                  </option>
                  <option value="payroll">Payroll sheets</option>
                  <option value="wht certificate">WHT KRA Certificates</option>
                  <option value="other">General Miscellaneous Docs</option>
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!selectedFile || uploading}
                  className={`w-full py-2 font-mono text-[10px] uppercase font-bold tracking-wider text-center flex items-center justify-center gap-1.5 disabled:opacity-50 ${accentBg} ${buttonRadius}`}
                >
                  <UploadCloud className="h-4 w-4" />
                  <span>{uploading ? "Uploading…" : "Secure Index File"}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
