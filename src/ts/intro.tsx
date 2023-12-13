import Headshot from "./comps/headshot";
import BackgroundText from "./comps/backgroundText";
import Lines from "./comps/lines";
import "../scss/intro.scss"

export default function Intro() {
  return (
    <>
      <div className="headshot-elements">
        <BackgroundText />
        {/* <Lines />  NOT SURE IF I LIKE THIS OR NOT */}
        <Headshot />
      </div>
    </>
  );
}
