"use client";

import { createContext, useContext, useMemo, useState } from "react";

interface PractitionerContextValue {
  practitionerName: string;
  setPractitionerName: (name: string) => void;
  practiceName: string;
  setPracticeName: (name: string) => void;
}

const PractitionerContext = createContext<PractitionerContextValue | undefined>(undefined);

export function PractitionerProvider({
  initialName,
  initialPracticeName,
  children,
}: {
  initialName: string;
  initialPracticeName?: string;
  children: React.ReactNode;
}) {
  const [practitionerName, setPractitionerName] = useState(initialName);
  const [practiceName, setPracticeName] = useState(initialPracticeName ?? "Stillwater Integration Studio");
  const value = useMemo(
    () => ({ practitionerName, setPractitionerName, practiceName, setPracticeName }),
    [practitionerName, practiceName]
  );

  return (
    <PractitionerContext.Provider value={value}>
      {children}
    </PractitionerContext.Provider>
  );
}

export function usePractitioner() {
  const context = useContext(PractitionerContext);
  if (!context) {
    throw new Error("usePractitioner must be used within PractitionerProvider");
  }
  return context;
}
