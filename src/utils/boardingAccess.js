export function isSchoolBoardingEnabled(user) {
  const mode = user?.school_accommodation_type;
  return mode === 'boarding' || mode === 'both';
}

export function isSchoolDayOnly(user) {
  return user?.school_accommodation_type === 'day';
}

export function isSchoolBoardingOnly(user) {
  return user?.school_accommodation_type === 'boarding';
}

export function canStudentUseBoarding(user) {
  if (user?.role !== 'student') return false;
  if (!isSchoolBoardingEnabled(user)) return false;
  return user?.student_residence_type === 'boarding';
}

export function studentResidenceLabel(value) {
  if (!value) return "";
  if (value === 'boarding') return 'Boarding Scholar';
  if (value === 'day') return 'Day Scholar';
  return "";
}

export function schoolAccommodationLabel(value) {
  if (value === 'boarding') return 'Boarding School';
  if (value === 'both') return 'Day & Boarding';
  return 'Day School';
}
