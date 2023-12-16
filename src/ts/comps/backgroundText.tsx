import "../../scss/backgroundText.scss";
import {
  createTheme,
  ThemeProvider,
} from "@mui/material/styles";
import Typography from "@mui/material/Typography";

let theme = createTheme();
theme.typography.h1 = {
  [theme.breakpoints.up('xs')]: {
    fontSize: '4rem'
  },
  [theme.breakpoints.up('sm')]: {
    fontSize: '7rem'
  },
  [theme.breakpoints.up('md')]: {
    fontSize: '10rem'
  },
  [theme.breakpoints.up('lg')]: {
    fontSize: '13rem'
  },
  [theme.breakpoints.up('xl')]: {
    fontSize: '16rem'
  },

};


export default function BackgroundText() {
  return (
    <>
      <ThemeProvider theme={theme}>
        <div className="background-text">
          <Typography
            className="background-text-p"
            variant="h1"
            style={{
              fontFamily: "Inter, sans-serif",
              margin: 0,
              textAlign: "center",
              fontWeight: 700,
              textShadow: "12px 17px 0px rgba(0, 0, 0, 0.25)",
            }}
          >
            GAGE <br /> WILLETTE
          </Typography>
        </div>
      </ThemeProvider>
    </>
  );
}
