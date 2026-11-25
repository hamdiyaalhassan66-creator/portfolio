import "./InfoButton.css";

// the "Info +" chip from the project cards, also used on Side Quests
export default function InfoButton({
  open,
  onClick,
  controls,
  className = "",
  label = "Info",
}: {
  open: boolean;
  onClick: () => void;
  controls?: string;
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      className={"ibtn" + (className ? " " + className : "")}
      aria-expanded={open}
      aria-controls={controls}
      onClick={onClick}
    >
      <span>{label}</span>
      <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d={open ? "M3.3 7.2h9.4v1.6H3.3z" : "M3.3 7.2h9.4v1.6H3.3zM7.2 3.3h1.6v9.4H7.2z"} />
      </svg>
    </button>
  );
}