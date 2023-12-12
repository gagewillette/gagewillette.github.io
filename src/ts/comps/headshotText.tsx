import { useTheme } from "@mui/material/styles";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

export default function HeadshotText() {
  const theme = useTheme();

  let cardStyles = {
    transition: "all 0.4s 0.5s ease",
    maxWidth: {
      xs: "90vw",
      sm: "90vw",
      md: "90vw",
      lg: "50vw",
      xl: "50vw",
    },
    width: {
      xs: "90%",
      sm: "50%",
      md: "50%",
      lg: "50%",
    },
    backgroundColor: theme.palette.secondary.main,
    maxHeight: "800",
    height: {
      xs: 200, // height for extra-small devices
      sm: 500, // height for small devices
      md: 500, // height for medium devices
      lg: 500, // height for large devices
      xl: 500, // height for extra-large devices
    },
  };

  return (
    <>
      <Card sx={cardStyles}>
        <CardContent>
          <Typography sx={{ fontSize: 14 }} color="text" gutterBottom>
            Introduction
          </Typography>
          <Typography variant="h5" component="div" color="text">
            Gage Willette
          </Typography>
          <Typography sx={{ mb: 1.5 }} color="text">
            A self taught, 18 year old programmer.
          </Typography>
          <Typography variant="body2">
            Well meaning, hardworking, and determined
            <br />
            {'"the best that it gets"'}
          </Typography>
        </CardContent>
        <CardActions>
          <Button size="small">Learn More</Button>{" "}
          {/* TODO: make this route to about me page */}
        </CardActions>
      </Card>
    </>
  );
}
