"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import {
  Vendor,
  Invoice,
  WhtPayment,
  GLAccount,
  Employee,
  ChecklistItem,
  AuditLog,
  BudgetItem,
  Document,
  initialVendors,
  initialInvoices,
  initialWhtPayments,
  initialGLAccounts,
  initialEmployees,
  initialChecklist,
  initialBudgets,
  initialAuditTrail,
  initialDocuments,
} from "@/lib/seeds";

export type UserRole =
  | "senior_accountant"
  | "finance_manager"
  | "production_manager"
  | "business_controller";

export interface AuthProfile {
  full_name: string;
  role: UserRole;
  email: string;
}

interface FinOpsContextType {
  currentUser: string;
  currentUserRole: UserRole | null;
  currentUserEmail: string | null;
  authLoading: boolean;
  applyAuthProfile: (profile: AuthProfile) => void;
  signOut: () => Promise<void>;
  vendors: Vendor[];
  addVendor: (vendor: Vendor) => void;
  updateVendor: (vendor: Vendor) => void;
  invoices: Invoice[];
  addInvoice: (invoice: Invoice) => void;
  updateInvoice: (invoice: Invoice) => void;
  deleteInvoice: (id: string, reason: string) => void;
  whtPayments: WhtPayment[];
  addWhtPayment: (payment: WhtPayment) => void;
  fileWhtPayments: (ids: string[], kraReference: string) => void;
  glAccounts: GLAccount[];
  addGLAccount: (account: GLAccount) => void;
  employees: Employee[];
  updateEmployee: (emp: Employee) => void;
  checklist: ChecklistItem[];
  updateChecklistItem: (
    id: string,
    status: ChecklistItem["status"],
    approver?: string | null,
  ) => void;
  budgets: BudgetItem[];
  updateBudgetActual: (id: string, actual: number) => void;
  documents: Document[];
  uploadDocument: (doc: Document) => void;
  deleteDocument: (id: string, reason: string) => void;
  auditTrail: AuditLog[];
  addAuditLog: (
    action: string,
    docRef: string,
    details: string,
    amount?: number,
  ) => void;
  clearSession: () => void;
}

const FinOpsContext = createContext<FinOpsContextType | undefined>(undefined);

export function FinOpsProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<string>("");
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [vendors, setVendors] = useState<Vendor[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("finops_vendors");
      return stored ? JSON.parse(stored) : initialVendors;
    }
    return initialVendors;
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("finops_invoices");
      return stored ? JSON.parse(stored) : initialInvoices;
    }
    return initialInvoices;
  });

  const [whtPayments, setWhtPayments] = useState<WhtPayment[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("finops_wht");
      return stored ? JSON.parse(stored) : initialWhtPayments;
    }
    return initialWhtPayments;
  });

  const [glAccounts, setGlAccounts] = useState<GLAccount[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("finops_gl");
      return stored ? JSON.parse(stored) : initialGLAccounts;
    }
    return initialGLAccounts;
  });

  const [employees, setEmployees] = useState<Employee[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("finops_employees");
      return stored ? JSON.parse(stored) : initialEmployees;
    }
    return initialEmployees;
  });

  const [checklist, setChecklist] = useState<ChecklistItem[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("finops_checklist");
      return stored ? JSON.parse(stored) : initialChecklist;
    }
    return initialChecklist;
  });

  const [budgets, setBudgets] = useState<BudgetItem[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("finops_budgets");
      return stored ? JSON.parse(stored) : initialBudgets;
    }
    return initialBudgets;
  });

  const [documents, setDocuments] = useState<Document[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("finops_docs");
      return stored ? JSON.parse(stored) : initialDocuments;
    }
    return initialDocuments;
  });

  const [auditTrail, setAuditTrail] = useState<AuditLog[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("finops_audit");
      return stored ? JSON.parse(stored) : initialAuditTrail;
    }
    return initialAuditTrail;
  });

  // Sync utilities
  const sync = (key: string, data: unknown) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(key, JSON.stringify(data));
    }
  };

  const applyAuthProfile = useCallback((profile: AuthProfile) => {
    setCurrentUserState(profile.full_name);
    setCurrentUserRole(profile.role);
    setCurrentUserEmail(profile.email);
  }, []);

  const signOut = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setCurrentUserState("");
    setCurrentUserRole(null);
    setCurrentUserEmail(null);
  }, []);

  // Hydrate the signed-in operator's identity from the Supabase session (page refresh,
  // direct navigation) and keep it in sync across tabs / token refresh.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    const loadProfile = async (userId: string) => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, role, email")
        .eq("id", userId)
        .single();

      if (data) {
        applyAuthProfile({
          full_name: data.full_name,
          role: data.role as UserRole,
          email: data.email,
        });
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadProfile(session.user.id).finally(() => setAuthLoading(false));
      } else {
        setAuthLoading(false);
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setCurrentUserState("");
        setCurrentUserRole(null);
        setCurrentUserEmail(null);
      } else if (session?.user) {
        loadProfile(session.user.id);
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, [applyAuthProfile]);

  const addAuditLog = (
    action: string,
    docRef: string,
    details: string,
    amount?: number,
  ) => {
    const timeInNairobi = new Date().toLocaleString("en-US", {
      timeZone: "Africa/Nairobi",
    });
    const formattedTime = new Date(timeInNairobi)
      .toISOString()
      .replace("T", " ")
      .substring(0, 19);

    const newLog: AuditLog = {
      id: `AUD-${Math.floor(100000 + Math.random() * 900000)}`,
      timestamp: formattedTime,
      user: currentUser,
      action,
      document_ref: docRef,
      details,
      amount,
    };

    setAuditTrail((prev) => {
      const updated = [newLog, ...prev];
      sync("finops_audit", updated);
      return updated;
    });
  };

  const addVendor = (vendor: Vendor) => {
    setVendors((prev) => {
      const updated = [...prev, vendor];
      sync("finops_vendors", updated);
      return updated;
    });
    addAuditLog(
      "VENDOR ADDED",
      vendor.vendor_id,
      `Created new vendor ${vendor.name} (${vendor.tax_id_pin})`,
    );
  };

  const updateVendor = (vendor: Vendor) => {
    setVendors((prev) => {
      const updated = prev.map((v) =>
        v.vendor_id === vendor.vendor_id ? vendor : v,
      );
      sync("finops_vendors", updated);
      return updated;
    });
    addAuditLog(
      "VENDOR UPDATED",
      vendor.vendor_id,
      `Updated vendor master configurations for ${vendor.name}`,
    );
  };

  const addInvoice = (invoice: Invoice) => {
    setInvoices((prev) => {
      const updated = [invoice, ...prev];
      sync("finops_invoices", updated);
      return updated;
    });
    addAuditLog(
      "INVOICE UPLOADED",
      invoice.id,
      `Uploaded invoice ${invoice.invoice_number} for vendor ${invoice.vendor_name}`,
      invoice.total,
    );
  };

  const updateInvoice = (invoice: Invoice) => {
    setInvoices((prev) => {
      const updated = prev.map((i) => (i.id === invoice.id ? invoice : i));
      sync("finops_invoices", updated);
      return updated;
    });
    addAuditLog(
      "INVOICE PROCESSED",
      invoice.id,
      `Status updated to ${invoice.status} for ${invoice.invoice_number}`,
      invoice.total,
    );
  };

  const deleteInvoice = (id: string, reason: string) => {
    const target = invoices.find((i) => i.id === id);
    setInvoices((prev) => {
      const updated = prev.filter((i) => i.id !== id);
      sync("finops_invoices", updated);
      return updated;
    });
    addAuditLog(
      "DOCUMENT DELETED",
      id,
      `Deleted Invoice Ref: ${target?.invoice_number || id}. Reason: ${reason}`,
      target?.total,
    );
  };

  const addWhtPayment = (payment: WhtPayment) => {
    setWhtPayments((prev) => {
      const updated = [payment, ...prev];
      sync("finops_wht", updated);
      return updated;
    });
    addAuditLog(
      "WHT CALCULATED",
      payment.id,
      `Calculated ${payment.wht_rate * 100}% withholding for invoice ${payment.cu_invoice_number}`,
      payment.wht_amount,
    );
  };

  const fileWhtPayments = (ids: string[], kraReference: string) => {
    setWhtPayments((prev) => {
      const updated = prev.map((p) =>
        ids.includes(p.id)
          ? { ...p, status: "Filed" as const, kra_reference: kraReference }
          : p,
      );
      sync("finops_wht", updated);
      return updated;
    });
    addAuditLog(
      "WHT FILED",
      kraReference,
      `Filed bulk WHT remittance of ${ids.length} entries to iTax. Reference: ${kraReference}`,
    );
  };

  const addGLAccount = (account: GLAccount) => {
    setGlAccounts((prev) => {
      const updated = [...prev, account];
      sync("finops_gl", updated);
      return updated;
    });
    addAuditLog(
      "CHART OF ACCOUNTS UPDATED",
      account.code,
      `Created GL Account: ${account.code} - ${account.name}`,
    );
  };

  const updateEmployee = (emp: Employee) => {
    setEmployees((prev) => {
      const updated = prev.map((e) => (e.id === emp.id ? emp : e));
      sync("finops_employees", updated);
      return updated;
    });
    addAuditLog(
      "PAYROLL UPDATED",
      emp.id,
      `Updated payroll lines for employee ${emp.name}`,
    );
  };

  const updateChecklistItem = (
    id: string,
    status: ChecklistItem["status"],
    approver?: string | null,
  ) => {
    setChecklist((prev) => {
      const updated = prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status,
              completed_date:
                status === "Complete"
                  ? new Date().toISOString().substring(0, 10)
                  : null,
              approver: status === "Complete" ? approver || currentUser : null,
            }
          : c,
      );
      sync("finops_checklist", updated);
      return updated;
    });
    addAuditLog("MONTH_END TASK", id, `Marked close task ${id} as ${status}`);
  };

  const updateBudgetActual = (id: string, actual: number) => {
    setBudgets((prev) => {
      const updated = prev.map((b) =>
        b.id === id ? { ...b, actual_amount: actual } : b,
      );
      sync("finops_budgets", updated);
      return updated;
    });
  };

  const uploadDocument = (doc: Document) => {
    setDocuments((prev) => {
      const updated = [doc, ...prev];
      sync("finops_docs", updated);
      return updated;
    });
    addAuditLog(
      "DOCUMENT STORED",
      doc.id,
      `Uploaded file "${doc.name}" tagged as ${doc.tag}`,
    );
  };

  const deleteDocument = (id: string, reason: string) => {
    const doc = documents.find((d) => d.id === id);
    setDocuments((prev) => {
      const updated = prev.filter((d) => d.id !== id);
      sync("finops_docs", updated);
      return updated;
    });
    addAuditLog(
      "DOCUMENT DELETED",
      id,
      `Removed file "${doc?.name || id}" from Document Store. Reason: ${reason}`,
    );
  };

  const clearSession = () => {
    if (typeof window !== "undefined") {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <FinOpsContext.Provider
      value={{
        currentUser,
        currentUserRole,
        currentUserEmail,
        authLoading,
        applyAuthProfile,
        signOut,
        vendors,
        addVendor,
        updateVendor,
        invoices,
        addInvoice,
        updateInvoice,
        deleteInvoice,
        whtPayments,
        addWhtPayment,
        fileWhtPayments,
        glAccounts,
        addGLAccount,
        employees,
        updateEmployee,
        checklist,
        updateChecklistItem,
        budgets,
        updateBudgetActual,
        documents,
        uploadDocument,
        deleteDocument,
        auditTrail,
        addAuditLog,
        clearSession,
      }}
    >
      {children}
    </FinOpsContext.Provider>
  );
}

export function useFinOps() {
  const context = useContext(FinOpsContext);
  if (context === undefined) {
    throw new Error("useFinOps must be used within a FinOpsProvider");
  }
  return context;
}
