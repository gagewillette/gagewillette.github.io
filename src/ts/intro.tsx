import Headshot from "./comps/headshot";
import HeadshotText from "./comps/headshotText";
import "../scss/intro.scss"

export default function Intro() {
  return (
    <>
      <div className="headshot-elements">
        <Headshot />
        <HeadshotText />
      </div>
    </>
  );
}
