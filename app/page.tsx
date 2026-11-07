import { Letter } from "@/components/Letter";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ seat?: string }>;
}) {
  const params = await searchParams;

  return (
    <>
      <a className="skip" href="#email">
        Skip to the seat
      </a>
      <main className="blotter">
        <header className="mast">
          <a className="word" href="/">
            First Round
          </a>
          <a href="#email">Take a seat</a>
        </header>
        <Letter initialSeat={params.seat} />
        <p className="colophon">No letter leaves without you.</p>
      </main>
    </>
  );
}
