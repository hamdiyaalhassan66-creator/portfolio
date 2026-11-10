import "./Disc.css";

type DiscProps = {
  image: string;
  alt: string;
};

export default function Disc({ image, alt }: DiscProps) {
  return (
    <div className="disc">
      <div className="disc__face">
        <img className="disc__art" src={image} alt={alt} draggable={false} />
        <div className="disc__sheen">
          <div className="disc__conic" />
          <div className="disc__conic disc__conic--multiply" />
          <div className="disc__diamond" />
        </div>
      </div>
      <div className="disc__rim" />
      <div className="disc__hub" />
      <div className="disc__ring" />
    </div>
  );
}