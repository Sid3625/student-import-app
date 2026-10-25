
CREATE TABLE IF NOT EXISTS students (
    id BIGINT PRIMARY KEY,
    student_code VARCHAR(20) NOT NULL UNIQUE,
    first_name VARCHAR(60) NOT NULL,
    last_name VARCHAR(60) NOT NULL,
    email VARCHAR(160) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(20) NOT NULL,
    course VARCHAR(100) NOT NULL,
    department VARCHAR(80) NOT NULL,
    admission_year SMALLINT NOT NULL,
    college_name VARCHAR(180) NOT NULL,
    college_city VARCHAR(100) NOT NULL,
    college_state VARCHAR(100) NOT NULL,
    college_country VARCHAR(80) NOT NULL,
    college_type VARCHAR(80) NOT NULL,
    college_category VARCHAR(80) NOT NULL,
    college_website VARCHAR(180) NOT NULL,
    college_address VARCHAR(220) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_students_college_city
    ON students (college_city);

CREATE INDEX IF NOT EXISTS idx_students_course
    ON students (course);

CREATE INDEX IF NOT EXISTS idx_students_admission_year
    ON students (admission_year);
