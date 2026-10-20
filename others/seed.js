require('dotenv').config();

const sequelize = require('../config/database');

const {
    Job,
    Category,
    Scholarship,
    Internship
} = require('../models');


async function seedDatabase() {

    try {

        // --------------------------------------------------
        // Connect to database
        // --------------------------------------------------

        await sequelize.authenticate();

        console.log('Database connected successfully.');


        // --------------------------------------------------
        // Synchronize models
        // --------------------------------------------------

        await sequelize.sync();

        console.log('Models synchronized.');


        // --------------------------------------------------
        // CATEGORIES
        // --------------------------------------------------

        console.log('Creating categories...');

        const categories = await Category.bulkCreate([

            {
                name: 'Information Technology',
                slug: 'information-technology',
                description:
                    'Jobs, internships and opportunities related to software, IT, networking and technology.',
                status: 'active'
            },

            {
                name: 'Engineering',
                slug: 'engineering',
                description:
                    'Engineering opportunities including civil, electrical, mechanical and related fields.',
                status: 'active'
            },

            {
                name: 'Finance',
                slug: 'finance',
                description:
                    'Finance, accounting, banking and financial management opportunities.',
                status: 'active'
            },

            {
                name: 'Health',
                slug: 'health',
                description:
                    'Healthcare, medicine, public health and related opportunities.',
                status: 'active'
            },

            {
                name: 'Education',
                slug: 'education',
                description:
                    'Teaching, education, academic and training opportunities.',
                status: 'active'
            }

        ]);

        console.log(`${categories.length} categories created.`);


        // --------------------------------------------------
        // JOBS
        // --------------------------------------------------

        console.log('Creating jobs...');

        const jobs = await Job.bulkCreate([

            {
                title: 'Junior Software Developer',

                slug: 'junior-software-developer-demo',

                companyName: 'ET24 Technology',

                companyInitials: 'ET',

                categoryId: categories[0].id,

                location: 'Addis Ababa',

                employmentType: 'full-time',

                salary: 'Negotiable',

                description:
                    'ET24 Technology is looking for a motivated Junior Software Developer to join its development team.',

                requirements:
                    'Basic knowledge of JavaScript, Node.js, HTML, CSS and MySQL.',

                responsibilities:
                    'Develop web applications, fix bugs, work with databases and collaborate with other developers.',

                qualifications:
                    'Bachelor degree or equivalent experience in Computer Science, Software Engineering or a related field.',

                deadline: '2026-09-30',

                applicationUrl:
                    'https://example.com/jobs/software-developer',

                applicationEmail:
                    'jobs@example.com',

                applicationInstructions:
                    'Submit your CV and application through the application link.',

                sourceName:
                    'ET24 Technology',

                sourceUrl:
                    'https://example.com/jobs/software-developer',

                status: 'published',

                views: 25,

                publishedAt: new Date()
            },

            {
                title: 'Civil Engineer',

                slug: 'civil-engineer-demo',

                companyName: 'ABC Construction PLC',

                companyInitials: 'ABC',

                categoryId: categories[1].id,

                location: 'Addis Ababa',

                employmentType: 'full-time',

                salary: 'Negotiable',

                description:
                    'ABC Construction PLC is seeking a Civil Engineer to support construction and infrastructure projects.',

                requirements:
                    'Experience with engineering drawings, construction supervision and project documentation.',

                responsibilities:
                    'Supervise construction activities, prepare technical reports and coordinate with project teams.',

                qualifications:
                    'BSc degree in Civil Engineering or a related field.',

                deadline: '2026-10-05',

                applicationUrl:
                    'https://example.com/jobs/civil-engineer',

                applicationEmail:
                    'hr@example.com',

                applicationInstructions:
                    'Send your CV and academic credentials through the application link.',

                sourceName:
                    'ABC Construction PLC',

                sourceUrl:
                    'https://example.com/jobs/civil-engineer',

                status: 'published',

                views: 12,

                publishedAt: new Date()
            },

            {
                title: 'Accountant',

                slug: 'accountant-demo',

                companyName: 'Ethiopian Business Group',

                companyInitials: 'EBG',

                categoryId: categories[2].id,

                location: 'Addis Ababa',

                employmentType: 'full-time',

                salary: 'Negotiable',

                description:
                    'Ethiopian Business Group is seeking an accountant to support financial operations.',

                requirements:
                    'Knowledge of accounting principles, financial reporting and spreadsheet applications.',

                responsibilities:
                    'Prepare financial records, reconcile accounts and assist with monthly financial reports.',

                qualifications:
                    'Bachelor degree in Accounting, Finance or a related discipline.',

                deadline: '2026-09-25',

                applicationUrl:
                    'https://example.com/jobs/accountant',

                applicationEmail:
                    'hr@example.com',

                applicationInstructions:
                    'Apply online with your CV and cover letter.',

                sourceName:
                    'Ethiopian Business Group',

                sourceUrl:
                    'https://example.com/jobs/accountant',

                status: 'published',

                views: 8,

                publishedAt: new Date()
            },

            {
                title: 'Public Health Officer',

                slug: 'public-health-officer-demo',

                companyName: 'Health Development Organization',

                companyInitials: 'HDO',

                categoryId: categories[3].id,

                location: 'Adama',

                employmentType: 'full-time',

                salary: 'Negotiable',

                description:
                    'Health Development Organization is looking for a Public Health Officer to support community health programs.',

                requirements:
                    'Experience in public health programs, data collection and community engagement.',

                responsibilities:
                    'Coordinate community health activities, prepare reports and support monitoring activities.',

                qualifications:
                    'Bachelor degree in Public Health or a related field.',

                deadline: '2026-10-12',

                applicationUrl:
                    'https://example.com/jobs/public-health-officer',

                applicationEmail:
                    'recruitment@example.com',

                applicationInstructions:
                    'Submit your CV and relevant credentials online.',

                sourceName:
                    'Health Development Organization',

                sourceUrl:
                    'https://example.com/jobs/public-health-officer',

                status: 'published',

                views: 16,

                publishedAt: new Date()
            },

            {
                title: 'Secondary School Teacher',

                slug: 'secondary-school-teacher-demo',

                companyName: 'Future Education Academy',

                companyInitials: 'FEA',

                categoryId: categories[4].id,

                location: 'Bishoftu',

                employmentType: 'full-time',

                salary: 'Negotiable',

                description:
                    'Future Education Academy is seeking qualified secondary school teachers.',

                requirements:
                    'Strong communication skills and classroom teaching experience.',

                responsibilities:
                    'Prepare lessons, teach students, assess performance and maintain academic records.',

                qualifications:
                    'Bachelor degree in Education or a relevant teaching subject.',

                deadline: '2026-09-20',

                applicationUrl:
                    'https://example.com/jobs/teacher',

                applicationEmail:
                    'jobs@example.com',

                applicationInstructions:
                    'Apply by submitting your CV and academic credentials.',

                sourceName:
                    'Future Education Academy',

                sourceUrl:
                    'https://example.com/jobs/teacher',

                status: 'published',

                views: 19,

                publishedAt: new Date()
            }

        ]);

        console.log(`${jobs.length} jobs created.`);


        // --------------------------------------------------
        // SCHOLARSHIPS
        // --------------------------------------------------

        console.log('Creating scholarships...');

        const scholarships = await Scholarship.bulkCreate([

            {
                title: 'Global Technology Scholarship 2027',

                slug: 'global-technology-scholarship-2027-demo',

                providerName: 'Global Technology University',

                providerWebsite: 'https://example.com',

                scholarshipType: 'Masters Scholarship',

                studyLevel: "Master's",

                fieldOfStudy:
                    'Computer Science, Software Engineering and Information Technology',

                hostCountry: 'Germany',

                hostInstitution: 'Global Technology University',

                studyMode: 'on-campus',

                fundingType: 'fully-funded',

                fundingDetails:
                    'Tuition fees, monthly stipend, travel support and health insurance.',

                eligibility:
                    'Open to international students with a relevant bachelor degree.',

                requirements:
                    'Academic transcripts, CV, recommendation letters and proof of English proficiency.',

                description:
                    'A fully funded scholarship opportunity for students interested in advanced technology studies.',

                applicationUrl:
                    'https://example.com/scholarships/technology',

                applicationInstructions:
                    'Complete the online application and upload the required documents.',

                deadline: '2026-12-15',

                sourceName:
                    'Global Technology University',

                sourceUrl:
                    'https://example.com/scholarships/technology',

                status: 'published',

                views: 120,

                publishedAt: new Date()
            },

            {
                title: 'International Engineering Scholarship',

                slug: 'international-engineering-scholarship-demo',

                providerName: 'International Engineering Foundation',

                providerWebsite: 'https://example.com',

                scholarshipType: 'Masters Scholarship',

                studyLevel: "Master's",

                fieldOfStudy:
                    'Civil, Mechanical and Electrical Engineering',

                hostCountry: 'United Kingdom',

                hostInstitution: 'Example University',

                studyMode: 'on-campus',

                fundingType: 'partially-funded',

                fundingDetails:
                    'Tuition support and an annual living allowance.',

                eligibility:
                    'Applicants must have a strong academic background in engineering.',

                requirements:
                    'Academic transcripts, CV, recommendation letters and personal statement.',

                description:
                    'Scholarship for talented international engineering students.',

                applicationUrl:
                    'https://example.com/scholarships/engineering',

                applicationInstructions:
                    'Apply through the official scholarship application portal.',

                deadline: '2026-11-30',

                sourceName:
                    'International Engineering Foundation',

                sourceUrl:
                    'https://example.com/scholarships/engineering',

                status: 'published',

                views: 87,

                publishedAt: new Date()
            },

            {
                title: 'African Finance Scholars Program',

                slug: 'african-finance-scholars-program-demo',

                providerName: 'African Finance Institute',

                providerWebsite: 'https://example.com',

                scholarshipType: 'Graduate Scholarship',

                studyLevel: "Master's",

                fieldOfStudy:
                    'Finance, Accounting and Economics',

                hostCountry: 'South Africa',

                hostInstitution: 'African Finance Institute',

                studyMode: 'on-campus',

                fundingType: 'fully-funded',

                fundingDetails:
                    'Tuition fees, accommodation and monthly stipend.',

                eligibility:
                    'Open to qualified African students pursuing graduate studies in finance-related fields.',

                requirements:
                    'Degree certificate, academic transcript, CV and motivation letter.',

                description:
                    'A scholarship program supporting future African finance professionals.',

                applicationUrl:
                    'https://example.com/scholarships/finance',

                applicationInstructions:
                    'Submit all required documents before the deadline.',

                deadline: '2026-11-15',

                sourceName:
                    'African Finance Institute',

                sourceUrl:
                    'https://example.com/scholarships/finance',

                status: 'published',

                views: 64,

                publishedAt: new Date()
            },

            {
                title: 'Global Public Health Scholarship',

                slug: 'global-public-health-scholarship-demo',

                providerName: 'International Health Foundation',

                providerWebsite: 'https://example.com',

                scholarshipType: 'Public Health Scholarship',

                studyLevel: "Master's",

                fieldOfStudy:
                    'Public Health and Health Sciences',

                hostCountry: 'Netherlands',

                hostInstitution:
                    'Example School of Public Health',

                studyMode: 'on-campus',

                fundingType: 'fully-funded',

                fundingDetails:
                    'Tuition fees, accommodation, insurance and monthly stipend.',

                eligibility:
                    'Applicants should have an academic background related to health sciences.',

                requirements:
                    'Academic transcripts, CV, recommendation letters and statement of purpose.',

                description:
                    'A scholarship supporting students interested in international public health.',

                applicationUrl:
                    'https://example.com/scholarships/public-health',

                applicationInstructions:
                    'Apply through the scholarship portal.',

                deadline: '2027-01-10',

                sourceName:
                    'International Health Foundation',

                sourceUrl:
                    'https://example.com/scholarships/public-health',

                status: 'published',

                views: 93,

                publishedAt: new Date()
            },

            {
                title: 'Future Teachers Scholarship',

                slug: 'future-teachers-scholarship-demo',

                providerName: 'Global Education Foundation',

                providerWebsite: 'https://example.com',

                scholarshipType: 'Education Scholarship',

                studyLevel: "Bachelor's / Master's",

                fieldOfStudy:
                    'Education and Teaching',

                hostCountry: 'Canada',

                hostInstitution:
                    'Example Education University',

                studyMode: 'on-campus',

                fundingType: 'tuition-only',

                fundingDetails:
                    'Partial tuition support for selected students.',

                eligibility:
                    'Open to students interested in pursuing careers in education.',

                requirements:
                    'Academic records, CV and motivation letter.',

                description:
                    'Scholarship designed to support the development of future teachers.',

                applicationUrl:
                    'https://example.com/scholarships/education',

                applicationInstructions:
                    'Complete the online scholarship application.',

                deadline: '2026-12-20',

                sourceName:
                    'Global Education Foundation',

                sourceUrl:
                    'https://example.com/scholarships/education',

                status: 'published',

                views: 71,

                publishedAt: new Date()
            }

        ]);

        console.log(`${scholarships.length} scholarships created.`);


        // --------------------------------------------------
        // INTERNSHIPS
        // --------------------------------------------------

        console.log('Creating internships...');

        const internships = await Internship.bulkCreate([

            {
                title: 'Software Development Internship',

                slug: 'software-development-internship-demo',

                organizationName: 'ET24 Technology',

                organizationWebsite: 'https://example.com',

                categoryId: categories[0].id,

                internshipType: 'full-time',

                duration: '6 months',

                location: 'Addis Ababa',

                fieldOfStudy:
                    'Computer Science, Software Engineering and IT',

                studyLevel:
                    'Undergraduate / Graduate',

                compensationType: 'stipend',

                compensationDetails:
                    'Monthly internship stipend provided.',

                description:
                    'An internship opportunity for students and recent graduates interested in software development.',

                responsibilities:
                    'Assist with software development, testing, debugging and documentation.',

                requirements:
                    'Basic programming knowledge and willingness to learn.',

                eligibility:
                    'Students and recent graduates in relevant fields.',

                benefits:
                    'Practical experience, mentorship and professional development.',

                applicationUrl:
                    'https://example.com/internships/software',

                applicationEmail:
                    'internships@example.com',

                applicationInstructions:
                    'Submit your CV through the application portal.',

                deadline:
                    '2026-09-30',

                startDate:
                    '2026-10-15',

                sourceName:
                    'ET24 Technology',

                sourceUrl:
                    'https://example.com/internships/software',

                status:
                    'published',

                views:
                    42,

                publishedAt:
                    new Date()
            },

            {
                title: 'Civil Engineering Internship',

                slug: 'civil-engineering-internship-demo',

                organizationName: 'ABC Construction PLC',

                organizationWebsite: 'https://example.com',

                categoryId: categories[1].id,

                internshipType: 'full-time',

                duration: '3 months',

                location: 'Addis Ababa',

                fieldOfStudy:
                    'Civil Engineering',

                studyLevel:
                    'Undergraduate',

                compensationType:
                    'allowance',

                compensationDetails:
                    'Transportation and lunch allowance provided.',

                description:
                    'A practical internship for civil engineering students.',

                responsibilities:
                    'Assist site engineers with measurements, documentation and construction monitoring.',

                requirements:
                    'Basic knowledge of engineering drawings and construction practices.',

                eligibility:
                    'Currently enrolled in a Civil Engineering program.',

                benefits:
                    'Site experience and professional mentorship.',

                applicationUrl:
                    'https://example.com/internships/civil',

                applicationInstructions:
                    'Apply online with your CV and university letter.',

                deadline:
                    '2026-10-05',

                startDate:
                    '2026-11-01',

                sourceName:
                    'ABC Construction PLC',

                sourceUrl:
                    'https://example.com/internships/civil',

                status:
                    'published',

                views:
                    35,

                publishedAt:
                    new Date()
            },

            {
                title: 'Finance Internship',

                slug: 'finance-internship-demo',

                organizationName:
                    'Ethiopian Business Group',

                organizationWebsite:
                    'https://example.com',

                categoryId:
                    categories[2].id,

                internshipType:
                    'part-time',

                duration:
                    '4 months',

                location:
                    'Addis Ababa',

                fieldOfStudy:
                    'Accounting, Finance and Economics',

                studyLevel:
                    'Undergraduate',

                compensationType:
                    'unpaid',

                compensationDetails:
                    null,

                description:
                    'An internship designed to provide practical exposure to accounting and financial operations.',

                responsibilities:
                    'Assist with financial records, data entry and basic financial reporting.',

                requirements:
                    'Basic accounting knowledge and spreadsheet skills.',

                eligibility:
                    'University students studying finance or accounting.',

                benefits:
                    'Practical workplace experience and professional references.',

                applicationUrl:
                    'https://example.com/internships/finance',

                applicationEmail:
                    'internships@example.com',

                applicationInstructions:
                    'Send your CV and university confirmation letter.',

                deadline:
                    '2026-09-25',

                startDate:
                    '2026-10-20',

                sourceName:
                    'Ethiopian Business Group',

                sourceUrl:
                    'https://example.com/internships/finance',

                status:
                    'published',

                views:
                    28,

                publishedAt:
                    new Date()
            },

            {
                title: 'Public Health Internship',

                slug: 'public-health-internship-demo',

                organizationName:
                    'Health Development Organization',

                organizationWebsite:
                    'https://example.com',

                categoryId:
                    categories[3].id,

                internshipType:
                    'full-time',

                duration:
                    '5 months',

                location:
                    'Adama',

                fieldOfStudy:
                    'Public Health and Health Sciences',

                studyLevel:
                    'Undergraduate / Graduate',

                compensationType:
                    'stipend',

                compensationDetails:
                    'Monthly stipend available.',

                description:
                    'An internship supporting community health and public health programs.',

                responsibilities:
                    'Support data collection, community activities and program monitoring.',

                requirements:
                    'Knowledge of basic research and data collection methods.',

                eligibility:
                    'Students or recent graduates in public health or related disciplines.',

                benefits:
                    'Field experience and public health program exposure.',

                applicationUrl:
                    'https://example.com/internships/public-health',

                applicationInstructions:
                    'Complete the online application.',

                deadline:
                    '2026-10-12',

                startDate:
                    '2026-11-10',

                sourceName:
                    'Health Development Organization',

                sourceUrl:
                    'https://example.com/internships/public-health',

                status:
                    'published',

                views:
                    51,

                publishedAt:
                    new Date()
            },

            {
                title: 'Education Internship',

                slug: 'education-internship-demo',

                organizationName:
                    'Future Education Academy',

                organizationWebsite:
                    'https://example.com',

                categoryId:
                    categories[4].id,

                internshipType:
                    'on-site',

                duration:
                    '3 months',

                location:
                    'Bishoftu',

                fieldOfStudy:
                    'Education and Teaching',

                studyLevel:
                    'Undergraduate',

                compensationType:
                    'allowance',

                compensationDetails:
                    'Transportation allowance provided.',

                description:
                    'A teaching internship for students preparing for careers in education.',

                responsibilities:
                    'Assist teachers, prepare learning materials and participate in classroom activities.',

                requirements:
                    'Good communication and basic teaching skills.',

                eligibility:
                    'Education students or recent graduates.',

                benefits:
                    'Classroom experience and mentorship from experienced teachers.',

                applicationUrl:
                    'https://example.com/internships/education',

                applicationEmail:
                    'internships@example.com',

                applicationInstructions:
                    'Submit your CV and university letter.',

                deadline:
                    '2026-09-20',

                startDate:
                    '2026-10-10',

                sourceName:
                    'Future Education Academy',

                sourceUrl:
                    'https://example.com/internships/education',

                status:
                    'published',

                views:
                    33,

                publishedAt:
                    new Date()
            }

        ]);

        console.log(`${internships.length} internships created.`);


        // --------------------------------------------------
        // SUMMARY
        // --------------------------------------------------

        console.log('\n-----------------------------------');
        console.log('DATABASE SEED COMPLETED');
        console.log('-----------------------------------');

        console.log(`Categories:    ${categories.length}`);
        console.log(`Jobs:          ${jobs.length}`);
        console.log(`Scholarships:  ${scholarships.length}`);
        console.log(`Internships:   ${internships.length}`);

        console.log('-----------------------------------');


    } catch (error) {

        console.error('\nDatabase seed failed:');

        console.error(error);

    } finally {

        await sequelize.close();

    }
}


seedDatabase();