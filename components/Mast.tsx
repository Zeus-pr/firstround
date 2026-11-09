import { AccountNav } from "@/components/AccountNav";

export function Mast() {
  return (
    <header className="mast">
      <div className="frame mast-row">
        <a className="word" href="/">
          <img src="/brand/firstround-logo.svg" alt="First Round" className="logo" />
        </a>
        <AccountNav />
      </div>
    </header>
  );
}
