"use client";
import { Printer } from "lucide-react";

export function PrintButton() {
  return <button className="btn btn-primary" type="button" onClick={() => window.print()}><Printer />Imprimir</button>;
}
