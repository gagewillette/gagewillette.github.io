import { useState, useEffect } from "react";
import headshotDesktop from "../../assets/KW30-desktop-transparent.png";
import "../../scss/headshot.scss";

export default function Headshot() {
  const [currentImage, setCurrentImage] = useState(headshotDesktop);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 480) {
        setCurrentImage(headshotDesktop);
      } else if (window.innerWidth <= 768) {
        setCurrentImage(headshotDesktop);
      } else {
        setCurrentImage(headshotDesktop);
      }
    };

    window.addEventListener("resize", handleResize);

    // Call handler right away so state gets updated with initial window size
    handleResize();

    // Remove event listener on cleanup
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <>
      <div className="headshot-container">
        <div className="headshot">
          <img src={currentImage} alt="headshot picture" />
        </div>
      </div>
    </>
  );
}
