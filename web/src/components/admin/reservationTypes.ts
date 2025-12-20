export type AdminReservation = {
  id: string;
  dateYmd: string; // YYYY-MM-DD
  time: string; // HH:mm
  name: string;
  phoneLast4: string;
  menu: string;
  durationMinutes: number;
  priceYen: number;
  via?: "web" | "phone";
};


