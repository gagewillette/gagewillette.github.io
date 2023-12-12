import React, { Component } from "react";
import { Button } from "@mui/material";

type ButtonProps = {
  text: string;
  pageRoute: string;
  isDisabled: boolean;
};

export default function MaterialButton(props: ButtonProps) {
  const { text, pageRoute, isDisabled } = props;

  function handleButtonClick() {
    alert(`navigate to ${pageRoute}`);
  }

  return (
    <Button onClick={handleButtonClick} variant="text" size="large" sx={{color: "white"}}>
      {text}
    </Button>
  );
}
