"use client";

import DoseAmountField from "@/components/client/DoseAmountField";
import JourneyMarkerSwitch from "@/components/client/JourneyMarkerSwitch";

type Marker = "started" | "booster" | "ended";

export default function JourneyTimingTimeline({
  hasSession,
  journeyStartedAt,
  boosterDoseAt,
  journeyEndedAt,
  markerPending,
  timeSavingMarker,
  onMarkerToggle,
  onMarkerTimeChange,
  initialDoseAmount,
  onInitialDoseChange,
  onInitialDoseSave,
  initialDoseSaving,
  initialDoseSaved,
  boosterDoseAmount,
  recordedBoosterDoseAmount,
  onBoosterDoseChange,
  onBoosterDoseSave,
  boosterDoseSaving,
  boosterDoseSaved,
}: {
  hasSession: boolean;
  journeyStartedAt?: string;
  boosterDoseAt?: string;
  journeyEndedAt?: string;
  markerPending: Marker | null;
  timeSavingMarker: Marker | null;
  onMarkerToggle: (marker: Marker) => void;
  onMarkerTimeChange: (marker: Marker, iso: string) => void;
  initialDoseAmount: string;
  onInitialDoseChange: (value: string) => void;
  onInitialDoseSave: () => void;
  initialDoseSaving: boolean;
  initialDoseSaved: boolean;
  boosterDoseAmount: string;
  recordedBoosterDoseAmount: string;
  onBoosterDoseChange: (value: string) => void;
  onBoosterDoseSave: () => void;
  boosterDoseSaving: boolean;
  boosterDoseSaved: boolean;
}) {
  return (
    <div className="journey-timing-grid" aria-label="Journey timing events">
      <div className="journey-timing-step">
        <span className="journey-timing-step-number">01</span>
        <DoseAmountField label="Initial dose" value={initialDoseAmount} onChange={onInitialDoseChange} onSave={onInitialDoseSave} saving={initialDoseSaving} saved={initialDoseSaved} disabled={!hasSession} />
      </div>
      <div className="journey-timing-step">
        <span className="journey-timing-step-number">02</span>
        <JourneyMarkerSwitch label="Journey start" actionLabel="Start journey" recordedLabel="Started" on={!!journeyStartedAt} pending={markerPending === "started"} disabled={!hasSession} isoTimestamp={journeyStartedAt} onToggle={() => onMarkerToggle("started")} onTimeChange={(iso) => onMarkerTimeChange("started", iso)} timeSaving={timeSavingMarker === "started"} />
      </div>
      <div className="journey-timing-step">
        <span className="journey-timing-step-number">03</span>
        <JourneyMarkerSwitch label="Booster dose (optional)" actionLabel="Add booster dose" recordedLabel="Added" on={!!boosterDoseAt} pending={markerPending === "booster"} disabled={!hasSession || !journeyStartedAt} isoTimestamp={boosterDoseAt} onToggle={() => onMarkerToggle("booster")} onTimeChange={(iso) => onMarkerTimeChange("booster", iso)} timeSaving={timeSavingMarker === "booster"} />
        {boosterDoseAt && recordedBoosterDoseAmount && <p className="journey-timing-dose-entry">Dose · {recordedBoosterDoseAmount}</p>}
        {boosterDoseAt && <DoseAmountField label="Booster amount" value={boosterDoseAmount} onChange={onBoosterDoseChange} onSave={onBoosterDoseSave} saving={boosterDoseSaving} saved={boosterDoseSaved} />}
      </div>
      <div className="journey-timing-step">
        <span className="journey-timing-step-number">04</span>
        <JourneyMarkerSwitch label="Journey end" actionLabel="End journey" recordedLabel="Ended" on={!!journeyEndedAt} pending={markerPending === "ended"} disabled={!hasSession || !journeyStartedAt} isoTimestamp={journeyEndedAt} onToggle={() => onMarkerToggle("ended")} onTimeChange={(iso) => onMarkerTimeChange("ended", iso)} timeSaving={timeSavingMarker === "ended"} />
      </div>
    </div>
  );
}
