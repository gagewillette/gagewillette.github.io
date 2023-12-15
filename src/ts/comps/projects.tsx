import ProjectCard from "./projectCard";

const inkDescription = "Lorem ipsem solor dit amet wiener balls suck my big fat cock generator balls niggs"

export default function Projects() {
  return (
    <>
      <div className="projects-container">
            <ProjectCard name="Ink Digital" description={inkDescription} />

      </div>
    </>
  );
}
