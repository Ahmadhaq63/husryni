"use client";

export default function PrintButton({ label, className = "btn-outline-primary" }: { label: string; className?: string }) {
  return (
    <button type="button" className={`btn ${className} no-print`} onClick={() => window.print()}>
      <i className="bi bi-printer me-2" aria-hidden />
      {label}
    </button>
  );
}
