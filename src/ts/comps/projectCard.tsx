import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import Typography from "@mui/material/Typography";
import { CardActionArea } from "@mui/material";
import InkDigital from "../../assets/ink.png"
import { useTheme } from "@emotion/react";
interface ProjectCardProps {
  name: string;
  description: string;
  //and more
}

export default function ProjectCard(props: ProjectCardProps) {

    const theme = useTheme();
    const {name, description } = props;

  return (
    <>
      <Card sx={{ maxWidth: 345 }}>
        <CardActionArea>
          <CardMedia
            component="img"
            height="140"
            image={InkDigital}
            alt="ink-digtial"
          />
          <CardContent>
            <Typography gutterBottom fontWeight={700} variant="h5" component="div" color="text.secondary">
              {name}
            </Typography>
            <Typography variant="body1" color="text.secondary" fontWeight={500}>
              {description}
            </Typography>
          </CardContent>
        </CardActionArea>
      </Card>
    </>
  );
}
