export function arkUniversityResearch(universities:readonly string[]):number {
  return Number(universities.includes('RESEARCH_2'))*2+Number(universities.includes('RESEARCH_REPUTATION'));
}
