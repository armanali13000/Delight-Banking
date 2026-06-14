import { appBase, logoPath } from "../config.js";

export function Brand({ small = "Banking Exam Guidance" }) {
  return (
    <a className="brand" href={appBase}>
      <img src={logoPath} alt="Delight Banking logo" />
      <span>
        <strong>Delight Banking</strong>
        <small>{small}</small>
      </span>
    </a>
  );
}
