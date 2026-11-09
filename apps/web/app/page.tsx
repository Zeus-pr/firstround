import { HomeLetter } from '@/components/HomeLetter';

export default async function Page({ searchParams }: { searchParams: Promise<{ seat?: string }> }) {
  const params = await searchParams;

  return (
    <>
      <a className="skip" href="#email">
        Skip to the seat
      </a>
      <main>
        <HomeLetter initialSeat={params.seat} />
      </main>
    </>
  );
}
