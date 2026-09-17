"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, Download, DollarSign, ExternalLink, FileText, MoreHorizontal, Pencil, X } from "@/components/ui/HeartfulIcon";
import RecordPaymentButton from "@/components/client/RecordPaymentButton";
import { updateOutstandingPaymentAction, updatePaymentAction, updatePaymentDueDateAction } from "@/lib/actions";
import { formatCurrency, formatDate } from "@/lib/utils";

type RecentPayment = { id: string; client: string; amount: number; date: string; method?: string; notes?: string };

export default function PaymentRowActions({ clientId, outstanding, dueDate, payment }: { clientId: string; outstanding?: number; dueDate?: string | null; payment?: RecentPayment }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [dueDateOpen, setDueDateOpen] = useState(false);
  const [outstandingEditOpen, setOutstandingEditOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function downloadReceipt() {
    if (!payment) return;
    const content = ["Heartful — Payment receipt", `Client: ${payment.client}`, `Amount: ${formatCurrency(payment.amount)}`, `Date: ${formatDate(payment.date)}`, `Method: ${payment.method ?? "Not specified"}`, payment.notes ? `Notes: ${payment.notes}` : ""].filter(Boolean).join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `heartful-receipt-${payment.id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    setMenuOpen(false);
  }

  return <div className="report-row-actions" ref={menuRef}>
    {outstanding !== undefined && <RecordPaymentButton clientId={clientId} outstanding={outstanding} open={recordOpen} onOpenChange={setRecordOpen} hideTrigger />}
    {payment && <PaymentDetailsDialog payment={payment} open={detailsOpen} onClose={() => setDetailsOpen(false)} />}
    {payment && editOpen && <EditPaymentDialog payment={payment} onClose={() => setEditOpen(false)} />}
    {outstanding !== undefined && dueDateOpen && <DueDateDialog clientId={clientId} initialDueDate={dueDate} onClose={() => setDueDateOpen(false)} />}
    {outstanding !== undefined && outstandingEditOpen && <OutstandingPaymentDialog clientId={clientId} initialOutstanding={outstanding} onClose={() => setOutstandingEditOpen(false)} />}
    <button type="button" className="report-row-menu-trigger" aria-label="Payment actions" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><MoreHorizontal aria-hidden="true" /></button>
    {menuOpen && <div className="report-row-menu" role="menu">
      {outstanding !== undefined && <>
        <button type="button" role="menuitem" className="report-row-menu-item" onClick={() => { setMenuOpen(false); setRecordOpen(true); }}><DollarSign aria-hidden="true" /><span>Mark as paid</span></button>
        <button type="button" role="menuitem" className="report-row-menu-item" onClick={() => { setMenuOpen(false); setDueDateOpen(true); }}><CalendarDays aria-hidden="true" /><span>Add / edit due date</span></button>
        <button type="button" role="menuitem" className="report-row-menu-item" onClick={() => { setMenuOpen(false); setOutstandingEditOpen(true); }}><Pencil aria-hidden="true" /><span>Edit payment</span></button>
      </>}
      {payment && <>
        <button type="button" role="menuitem" className="report-row-menu-item" onClick={() => { setMenuOpen(false); setDetailsOpen(true); }}><FileText aria-hidden="true" /><span>View payment details</span></button>
        <Link href={`/clients/${clientId}`} role="menuitem" className="report-row-menu-item" onClick={() => setMenuOpen(false)}><ExternalLink aria-hidden="true" /><span>Open client record</span></Link>
        <button type="button" role="menuitem" className="report-row-menu-item" onClick={() => { setMenuOpen(false); setEditOpen(true); }}><Pencil aria-hidden="true" /><span>Edit payment</span></button>
        <button type="button" role="menuitem" className="report-row-menu-item" onClick={downloadReceipt}><Download aria-hidden="true" /><span>Download receipt</span></button>
      </>}
      {!payment && <Link href={`/clients/${clientId}`} role="menuitem" className="report-row-menu-item" onClick={() => setMenuOpen(false)}><ExternalLink aria-hidden="true" /><span>Open client record</span></Link>}
    </div>}
  </div>;
}

function PaymentDetailsDialog({ payment, open, onClose }: { payment: RecentPayment; open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="payment-details-title">
    <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-center justify-between"><h2 id="payment-details-title" className="font-semibold text-ink-900">Payment details</h2><button type="button" onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-ink-600"><X className="h-5 w-5" /></button></div><dl className="report-payment-details"><div><dt>Client</dt><dd>{payment.client}</dd></div><div><dt>Amount</dt><dd>{formatCurrency(payment.amount)}</dd></div><div><dt>Date</dt><dd>{formatDate(payment.date)}</dd></div><div><dt>Method</dt><dd>{payment.method ?? "Not specified"}</dd></div>{payment.notes && <div><dt>Notes</dt><dd>{payment.notes}</dd></div>}</dl></div>
  </div>;
}

function EditPaymentDialog({ payment, onClose }: { payment: RecentPayment; onClose: () => void }) {
  const [amount, setAmount] = useState(payment.amount.toFixed(2));
  const [paidAt, setPaidAt] = useState(payment.date.slice(0, 10));
  const [method, setMethod] = useState(payment.method ?? "");
  const [notes, setNotes] = useState(payment.notes ?? "");
  const [saving, setSaving] = useState(false);
  async function save() {
    const parsed = Number(amount);
    if (!parsed || parsed <= 0) return;
    setSaving(true);
    await updatePaymentAction(payment.id, { amount: parsed, paidAt, method: method || undefined, notes: notes || undefined });
    setSaving(false);
    onClose();
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="edit-payment-title"><div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-center justify-between"><h2 id="edit-payment-title" className="font-semibold text-ink-900">Edit payment</h2><button type="button" onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-ink-600"><X className="h-5 w-5" /></button></div><div className="space-y-3"><Field label="Amount ($)"><input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></Field><Field label="Date"><input type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} /></Field><Field label="Method"><input value={method} onChange={(event) => setMethod(event.target.value)} /></Field><Field label="Notes"><input value={notes} onChange={(event) => setNotes(event.target.value)} /></Field></div><div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancel</button><button type="button" disabled={saving} onClick={save} className="btn-primary px-4 py-2 text-sm">{saving ? "Saving…" : "Save changes"}</button></div></div></div>;
}

function DueDateDialog({ clientId, initialDueDate, onClose }: { clientId: string; initialDueDate?: string | null; onClose: () => void }) {
  const [dueDate, setDueDate] = useState(formatDateInput(initialDueDate));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    const isoDate = dueDate ? parseEnglishDate(dueDate) : undefined;
    if (dueDate && !isoDate) {
      setError("Enter a date as MM/DD/YYYY.");
      return;
    }
    setSaving(true);
    await updatePaymentDueDateAction(clientId, isoDate);
    setSaving(false);
    onClose();
  }
  return <PaymentModal title="Payment due date" onClose={onClose}>
    <Field label="Due date"><input type="text" inputMode="numeric" placeholder="MM/DD/YYYY" value={dueDate} onChange={(event) => { setDueDate(event.target.value); setError(""); }} autoFocus /></Field>
    {error && <p className="text-xs text-red-600">{error}</p>}
    <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancel</button><button type="button" disabled={saving} onClick={save} className="btn-primary px-4 py-2 text-sm">{saving ? "Saving…" : "Save date"}</button></div>
  </PaymentModal>;
}

function OutstandingPaymentDialog({ clientId, initialOutstanding, onClose }: { clientId: string; initialOutstanding: number; onClose: () => void }) {
  const [amount, setAmount] = useState(initialOutstanding.toFixed(2));
  const [saving, setSaving] = useState(false);
  async function save() {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    setSaving(true);
    await updateOutstandingPaymentAction(clientId, parsed);
    setSaving(false);
    onClose();
  }
  return <PaymentModal title="Edit payment" onClose={onClose}>
    <Field label="Outstanding amount ($)"><input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} autoFocus /></Field>
    <p className="text-xs leading-relaxed text-ink-400">Updates the remaining balance without creating a new payment transaction.</p>
    <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancel</button><button type="button" disabled={saving} onClick={save} className="btn-primary px-4 py-2 text-sm">{saving ? "Saving…" : "Save changes"}</button></div>
  </PaymentModal>;
}

function PaymentModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}><div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-center justify-between"><h2 className="font-semibold text-ink-900">{title}</h2><button type="button" onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-ink-600"><X className="h-5 w-5" /></button></div>{children}</div></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-xs font-medium text-ink-600">{label}<span className="mt-1 block [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:border-ink-200 [&_input]:px-3 [&_input]:py-2 [&_input]:text-sm [&_input]:focus:outline-none [&_input]:focus:ring-2 [&_input]:focus:ring-clay-300">{children}</span></label>; }

function formatDateInput(date?: string | null) {
  const match = date?.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[2]}/${match[3]}/${match[1]}` : "";
}

function parseEnglishDate(value: string) {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return undefined;
  const [, month, day, year] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00`);
  return Number.isNaN(date.getTime()) || date.getMonth() + 1 !== Number(month) || date.getDate() !== Number(day) ? undefined : `${year}-${month}-${day}`;
}
