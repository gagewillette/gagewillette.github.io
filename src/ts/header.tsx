import "../scss/header.scss";
import MaterialButton from "./comps/materialButton";

export default function Header() {
  return (
    <>
      <div className="header-container">
        <div className="buttons-container">
          <div className="home-button-container">
            <MaterialButton text="Home" isDisabled={false} pageRoute="/home" />
          </div>
          <div className="work-button-container">
            <MaterialButton text="My Work" isDisabled={false} pageRoute="/home" />
          </div>
          <div className="about-button-container">
            <MaterialButton text="About Me" isDisabled={false} pageRoute="/home" />
          </div>
        </div>
      </div>
    </>
  );
}
