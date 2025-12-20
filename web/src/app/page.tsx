export default function HomePage() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <div className="rounded-2xl bg-white/80 p-6 shadow-soft ring-1 ring-slate-200/70 backdrop-blur">
        <h1 className="text-xl font-semibold tracking-tight text-slate-800">
          ネイルショップ予約システム
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          まずは管理画面UIのデザイン実装から進めています。
        </p>
        <div className="mt-5">
          <a
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400/60"
            href="/admin"
          >
            管理画面へ
          </a>
        </div>
      </div>
    </main>
  );
}


