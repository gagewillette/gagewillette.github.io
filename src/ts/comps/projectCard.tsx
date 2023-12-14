
interface ProjectCardProps
{
    name: string
    description: string
    //and more
}

export default function ProjectCard(props: ProjectCardProps) 
{
    const { name , description } = props;


    console.log(name + description)

}