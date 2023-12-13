import Headshot from "./comps/headshot";
import BackgroundText from "./comps/backgroundText";
import Lines from "./comps/lines";
import "../scss/intro.scss"

export default function Intro() {
  return (
    <>
      <div className="headshot-elements">
        <BackgroundText />
        <Lines />
        <Headshot />
      </div>
    </>
  );
}
