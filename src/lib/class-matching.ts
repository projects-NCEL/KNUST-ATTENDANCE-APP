/**
 * Normalizes any level representation into a standard comparable string (e.g., "100", "200", "300", "400").
 * Handles: 200, "200", "L200", "Level 200", "LVL 200", "2nd Year", etc.
 */
export function normalizeLevel(val: any): string {
  if (val === null || val === undefined) return "";
  const str = String(val).trim().toUpperCase();
  const digits = str.match(/\d+/);
  if (digits) {
    return digits[0];
  }
  return str.replace(/LEVEL|LVL|L/g, "").trim();
}

export interface StudentLike {
  id: string;
  full_name?: string;
  index_number?: string;
  level?: any;
  department_id?: string | null;
  program?: string | null;
  departments?: { name?: string } | null;
  [key: string]: any;
}

export interface CourseLike {
  id: string;
  code?: string;
  title?: string;
  level?: any;
  department_id?: string | null;
  departments?: { name?: string } | null;
  department_name?: string | null;
  [key: string]: any;
}

/**
 * Determines if a student belongs to a given course based on:
 * 1. Explicit registration in course_registrations, OR
 * 2. Class Level matching the course's level AND department matching (if course specifies a department).
 */
export function isStudentInCourse(
  student: StudentLike,
  course: CourseLike,
  registeredStudentIds?: Set<string>,
  deptMap?: Map<string, string>,
): boolean {
  if (!student || !course) return false;

  // 1. Explicit registration takes highest precedence
  if (registeredStudentIds && registeredStudentIds.has(student.id)) {
    return true;
  }

  // 2. Check Level Match
  const cLevel = normalizeLevel(course.level);
  const sLevel = normalizeLevel(student.level);
  if (!cLevel || !sLevel || cLevel !== sLevel) {
    return false;
  }

  // 3. Department matching
  // If the course is assigned to a specific department:
  if (course.department_id) {
    // If student has a matching department_id:
    if (student.department_id && student.department_id === course.department_id) {
      return true;
    }

    // Check department name / program name
    const courseDeptName =
      (deptMap && deptMap.get(course.department_id)) ||
      course.departments?.name ||
      course.department_name;

    const studentDeptName =
      (student.department_id && deptMap && deptMap.get(student.department_id)) ||
      student.departments?.name ||
      student.program;

    if (
      courseDeptName &&
      studentDeptName &&
      courseDeptName.trim().toLowerCase() === studentDeptName.trim().toLowerCase()
    ) {
      return true;
    }

    // If student has no department or program set at all, but is in the same level:
    // they are considered eligible for this level's course under this lecturer
    if (!student.department_id && !student.program) {
      return true;
    }

    return false;
  }

  // If the course has no specific department assigned, all students of this level belong to it
  return true;
}

/**
 * Returns all students who belong to a course (combining explicit registrations and class level population).
 */
export function getCoursePopulation(
  course: CourseLike,
  allStudents: StudentLike[],
  registeredStudentIds?: Set<string>,
  deptMap?: Map<string, string>,
): StudentLike[] {
  return (allStudents || []).filter((s) =>
    isStudentInCourse(s, course, registeredStudentIds, deptMap),
  );
}

/**
 * Robustly detects or infers the academic class level (e.g., "100", "200", "300", "400")
 * from course object, explicit level field, or course code digits (e.g. "COE 354" -> "300").
 */
export function inferLevelFromCourse(course: CourseLike | any): string {
  if (!course) return "";
  if (course.level) {
    const l = normalizeLevel(course.level);
    if (l) return l;
  }
  // Try course code (e.g. "COE 354", "EE 211", "CE 101", "CS 420")
  const code = String(course.code || "").trim();
  const threeDigitsMatch = code.match(/\b([1-6])\d{2}\b/);
  if (threeDigitsMatch && threeDigitsMatch[1]) {
    return `${threeDigitsMatch[1]}00`;
  }
  const generalNum = code.match(/(\d{3})/);
  if (generalNum && generalNum[1]) {
    const firstDigit = generalNum[1][0];
    if (["1", "2", "3", "4", "5", "6"].includes(firstDigit)) {
      return `${firstDigit}00`;
    }
  }
  // Try title (e.g. "Level 300 Digital Systems" or "Year 2 Calculus")
  const title = String(course.title || "").trim();
  const titleMatch = title.match(/(?:LEVEL|LVL|YEAR)\s*([1-6])(?:00)?/i);
  if (titleMatch && titleMatch[1]) {
    return `${titleMatch[1]}00`;
  }
  return "";
}
