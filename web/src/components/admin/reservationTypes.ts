export type AdminReservation = {
  id: string;
  dateYmd: string; // YYYY-MM-DD
  time: string; // HH:mm
  name: string;
  lineUserId: string; // LINE ユーザー ID
  lineDisplayName?: string; // LINE 表示名（任意）
  menu: string;
  durationMinutes: number;
  priceYen: number;
  via?: "web" | "phone" | "admin";
  arrivedAt?: string; // ISO string
};


