import Intro from "./ts/intro";
import Header from "./ts/header";
import "./scss/main.scss";
import { createTheme, ThemeProvider } from "@mui/material/styles";

import "@fontsource/open-sans";

const theme = createTheme({
  palette: {
    background: {
      default: '#242424',
    },
    text: {
      primary: '#F1EAE9',
    },
    primary: {
      main: '#C6ABA7',
    },
    secondary: {
      main: '#446968',
    },
  },
  typography: {
    fontFamily: ["Open Sans", "sans-serif"].join(","),
  },
});

function App() {
  return (
    <>
      <ThemeProvider theme={theme}>
        <Header />

        <Intro />
      </ThemeProvider>
    </>
  );
}

export default App;
