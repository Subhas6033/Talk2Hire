import React, { useState } from "react";

// ── Section Data ─────────────────────────────────────────────────────────────

const sections = [
  {
    id: "acceptance",
    number: "01",
    title: "Acceptance of Terms",
    content: (
      <div className="space-y-4">
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          By accessing or using the Talk2Hire platform, website, or any related
          services (collectively, the "Services"), you agree to be bound by
          these Terms and Conditions ("Terms"). If you do not agree to these
          Terms, please do not access or use our Services.
        </p>
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          These Terms constitute a legally binding agreement between you and
          Talk2Hire ("Talk2Hire," "we," "us," or "our"). By creating an account,
          submitting an application, posting a job, or otherwise using our
          Services, you confirm that you have read, understood, and agreed to
          these Terms and our Privacy Policy.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
          {[
            {
              label: "Candidates",
              desc: "Job seekers using Talk2Hire to find roles, prepare for interviews, or complete AI-powered assessments.",
            },
            {
              label: "Employers",
              desc: "Companies and hiring managers using Talk2Hire to source, screen, and hire candidates.",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="border border-gray-100 rounded-xl p-4 bg-gray-50"
            >
              <p className="text-xs font-semibold text-gray-800 mb-1">
                {item.label}
              </p>
              <p className="text-xs text-gray-400 font-light leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "services",
    number: "02",
    title: "Description of Services",
    content: (
      <div className="space-y-4">
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          Talk2Hire provides an AI-powered recruitment and interview platform
          that connects job seekers with employers. Our Services include, but
          are not limited to:
        </p>
        <ul className="space-y-2">
          {[
            "AI-driven interview screening and candidate assessment tools.",
            "Job matching and recommendation services powered by machine learning.",
            "Employer dashboards for managing job postings and reviewing candidates.",
            "Candidate profiles, resume parsing, and portfolio features.",
            "Interview scheduling, feedback, and analytics tools.",
            "Coaching and preparation resources for job seekers.",
            "Communication tools between employers and candidates.",
          ].map((item) => (
            <li
              key={item}
              className="flex items-start gap-2.5 text-sm text-gray-500 font-light leading-relaxed"
            >
              <span className="mt-2 w-1 h-1 rounded-full bg-gray-300 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          Talk2Hire reserves the right to modify, suspend, or discontinue any
          part of the Services at any time, with or without notice. We will not
          be liable to you or any third party for any modification, suspension,
          or discontinuation of Services.
        </p>
      </div>
    ),
  },
  {
    id: "eligibility",
    number: "03",
    title: "Eligibility & Account Registration",
    content: (
      <div className="space-y-5">
        <div className="border-l-2 border-gray-100 pl-4">
          <p className="text-xs font-semibold tracking-widest uppercase text-gray-700 mb-1.5">
            Age Requirement
          </p>
          <p className="text-sm text-gray-500 font-light leading-relaxed">
            You must be at least 18 years old to use our Services. By
            registering, you confirm that you meet this requirement. We do not
            knowingly collect information from individuals under 18.
          </p>
        </div>
        <div className="border-l-2 border-gray-100 pl-4">
          <p className="text-xs font-semibold tracking-widest uppercase text-gray-700 mb-1.5">
            Account Accuracy
          </p>
          <p className="text-sm text-gray-500 font-light leading-relaxed">
            You agree to provide accurate, current, and complete information
            when creating your account and to keep this information up to date.
            Providing false or misleading information may result in immediate
            account termination.
          </p>
        </div>
        <div className="border-l-2 border-gray-100 pl-4">
          <p className="text-xs font-semibold tracking-widest uppercase text-gray-700 mb-1.5">
            Account Security
          </p>
          <p className="text-sm text-gray-500 font-light leading-relaxed">
            You are responsible for maintaining the confidentiality of your
            account credentials and for all activities that occur under your
            account. Notify us immediately at{" "}
            <a
              href="mailto:support@talk2hire.com"
              className="text-gray-800 font-medium border-b border-gray-300 hover:border-gray-900 transition-colors duration-150"
            >
              support@talk2hire.com
            </a>{" "}
            if you suspect any unauthorized use of your account.
          </p>
        </div>
        <div className="border-l-2 border-gray-100 pl-4">
          <p className="text-xs font-semibold tracking-widest uppercase text-gray-700 mb-1.5">
            One Account Per User
          </p>
          <p className="text-sm text-gray-500 font-light leading-relaxed">
            Each person may register only one account. Creating duplicate
            accounts or accounts on behalf of others without authorization is
            prohibited and may result in all associated accounts being
            suspended.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "user-conduct",
    number: "04",
    title: "User Conduct & Prohibited Activities",
    content: (
      <div className="space-y-4">
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          By using Talk2Hire, you agree to use our Services only for lawful
          purposes and in a manner that does not infringe the rights of others.
          The following activities are strictly prohibited:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            "Posting false, misleading, or fraudulent job listings or candidate profiles.",
            "Impersonating any person, company, or entity.",
            "Scraping, crawling, or using automated means to access our platform without permission.",
            "Uploading viruses, malware, or any harmful code.",
            "Harassing, abusing, or threatening other users on the platform.",
            "Circumventing our AI interview processes or submitting AI-generated responses as genuine.",
            "Using the platform for any unlawful discrimination in hiring practices.",
            "Reselling or commercializing Talk2Hire data or content without written consent.",
            "Attempting to gain unauthorized access to any part of our systems.",
            "Interfering with the proper functioning of the platform.",
          ].map((item) => (
            <div
              key={item}
              className="flex items-start gap-2.5 border border-gray-100 rounded-xl px-4 py-3 bg-gray-50"
            >
              <span className="mt-1 text-gray-300 text-lg leading-none shrink-0">
                ×
              </span>
              <p className="text-xs text-gray-500 font-light leading-relaxed">
                {item}
              </p>
            </div>
          ))}
        </div>
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          Violation of these rules may result in immediate account suspension,
          termination, and where applicable, legal action.
        </p>
      </div>
    ),
  },
  {
    id: "ai-services",
    number: "05",
    title: "AI-Powered Features",
    content: (
      <div className="space-y-5">
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          Talk2Hire's platform incorporates artificial intelligence and machine
          learning technologies to power interviews, candidate matching, and
          assessments. By using these features, you acknowledge and agree to the
          following:
        </p>
        <div className="border-l-2 border-gray-100 pl-4">
          <p className="text-xs font-semibold tracking-widest uppercase text-gray-700 mb-1.5">
            AI Interview Assessments
          </p>
          <p className="text-sm text-gray-500 font-light leading-relaxed">
            Our AI interviewer analyzes your responses, communication style, and
            other signals to generate assessments. These assessments are tools
            to assist — not replace — human judgment. Employers are responsible
            for making final hiring decisions.
          </p>
        </div>
        <div className="border-l-2 border-gray-100 pl-4">
          <p className="text-xs font-semibold tracking-widest uppercase text-gray-700 mb-1.5">
            No Guarantee of Outcomes
          </p>
          <p className="text-sm text-gray-500 font-light leading-relaxed">
            Talk2Hire does not guarantee that using our AI tools will result in
            job placement, interview success, or any particular hiring outcome.
            AI assessments are probabilistic and may not reflect your full
            capabilities.
          </p>
        </div>
        <div className="border-l-2 border-gray-100 pl-4">
          <p className="text-xs font-semibold tracking-widest uppercase text-gray-700 mb-1.5">
            Data Use for AI Training
          </p>
          <p className="text-sm text-gray-500 font-light leading-relaxed">
            With your consent, anonymized and aggregated data from your
            interactions may be used to improve our AI models. You may opt out
            of this data use through your account privacy settings or by
            contacting{" "}
            <a
              href="mailto:support@talk2hire.com"
              className="text-gray-800 font-medium border-b border-gray-300 hover:border-gray-900 transition-colors duration-150"
            >
              support@talk2hire.com
            </a>
            .
          </p>
        </div>
        <div className="border-l-2 border-gray-100 pl-4">
          <p className="text-xs font-semibold tracking-widest uppercase text-gray-700 mb-1.5">
            Authentic Participation
          </p>
          <p className="text-sm text-gray-500 font-light leading-relaxed">
            Candidates must participate in AI interviews authentically and
            personally. Submitting responses generated by third-party AI tools,
            having another person complete your assessment, or otherwise
            misrepresenting your identity during an AI interview is a material
            breach of these Terms.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "employer-terms",
    number: "06",
    title: "Employer Responsibilities",
    content: (
      <div className="space-y-5">
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          Employers using Talk2Hire to recruit, screen, and hire candidates take
          on specific responsibilities under these Terms.
        </p>
        {[
          {
            title: "Lawful Job Postings",
            desc: "Employers must post only genuine, lawful job opportunities. Job listings must be accurate, non-discriminatory, and compliant with applicable employment laws in the jurisdictions where roles are advertised.",
          },
          {
            title: "Fair Use of Assessments",
            desc: "Employers may use Talk2Hire's AI assessment tools only as part of a fair, non-discriminatory hiring process. AI scores must not be the sole basis for rejection. Employers remain fully liable for their final hiring decisions.",
          },
          {
            title: "Candidate Data Handling",
            desc: "Employers agree to handle candidate personal data in accordance with applicable data protection laws (including GDPR and CCPA), and must not share, sell, or misuse candidate information obtained through Talk2Hire.",
          },
          {
            title: "Payment & Subscriptions",
            desc: "Employer accounts on paid plans agree to the billing terms in their subscription agreement. All fees are non-refundable except as required by law or as explicitly stated in your plan documentation.",
          },
          {
            title: "No Circumvention",
            desc: "Employers may not use Talk2Hire to identify and then recruit candidates through outside channels to avoid platform fees. Attempting to circumvent our platform's fee structure is a material breach of these Terms.",
          },
        ].map((item) => (
          <div key={item.title} className="border-l-2 border-gray-100 pl-4">
            <p className="text-xs font-semibold tracking-widest uppercase text-gray-700 mb-1.5">
              {item.title}
            </p>
            <p className="text-sm text-gray-500 font-light leading-relaxed">
              {item.desc}
            </p>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "intellectual-property",
    number: "07",
    title: "Intellectual Property",
    content: (
      <div className="space-y-5">
        <div className="border-l-2 border-gray-100 pl-4">
          <p className="text-xs font-semibold tracking-widest uppercase text-gray-700 mb-1.5">
            Our Intellectual Property
          </p>
          <p className="text-sm text-gray-500 font-light leading-relaxed">
            All content on the Talk2Hire platform — including but not limited to
            software, algorithms, UI designs, logos, trademarks, text, graphics,
            and AI models — is the exclusive property of Talk2Hire or its
            licensors and is protected by applicable intellectual property laws.
            You may not reproduce, distribute, or create derivative works
            without our express written consent.
          </p>
        </div>
        <div className="border-l-2 border-gray-100 pl-4">
          <p className="text-xs font-semibold tracking-widest uppercase text-gray-700 mb-1.5">
            Your Content
          </p>
          <p className="text-sm text-gray-500 font-light leading-relaxed">
            You retain ownership of content you submit to Talk2Hire (e.g.,
            resumes, cover letters, job descriptions). By submitting content,
            you grant Talk2Hire a non-exclusive, worldwide, royalty-free licence
            to use, store, display, and process your content solely to provide
            and improve our Services.
          </p>
        </div>
        <div className="border-l-2 border-gray-100 pl-4">
          <p className="text-xs font-semibold tracking-widest uppercase text-gray-700 mb-1.5">
            Feedback
          </p>
          <p className="text-sm text-gray-500 font-light leading-relaxed">
            Any feedback, suggestions, or ideas you provide to us about the
            platform may be used by Talk2Hire without restriction or
            compensation to you. We are not obligated to keep such feedback
            confidential.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "privacy",
    number: "08",
    title: "Privacy & Data Protection",
    content: (
      <div className="space-y-4">
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          Your privacy matters to us. Our collection, use, and sharing of your
          personal information is governed by our{" "}
          <a
            href="/privacy"
            className="text-gray-800 font-medium border-b border-gray-300 hover:border-gray-900 transition-colors duration-150"
          >
            Privacy Policy
          </a>
          , which is incorporated into these Terms by reference.
        </p>
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          By using our Services, you consent to our collection and use of your
          data as described in the Privacy Policy. We comply with applicable
          data protection regulations including GDPR, UK GDPR, and CCPA. For
          cookie-related preferences, please review our{" "}
          <a
            href="/cookies"
            className="text-gray-800 font-medium border-b border-gray-300 hover:border-gray-900 transition-colors duration-150"
          >
            Cookie Policy
          </a>
          .
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
          {[
            { label: "GDPR", desc: "EU & UK data protection compliance." },
            {
              label: "CCPA",
              desc: "California Consumer Privacy Act compliance.",
            },
            {
              label: "SOC 2 Type II",
              desc: "Independently audited security controls.",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="border border-gray-100 rounded-xl p-4 bg-gray-50 text-center"
            >
              <p className="text-xs font-bold text-gray-800 mb-1">
                {item.label}
              </p>
              <p className="text-xs text-gray-400 font-light">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "payments",
    number: "09",
    title: "Payments & Subscriptions",
    content: (
      <div className="space-y-5">
        {[
          {
            title: "Subscription Plans",
            desc: "Certain features of Talk2Hire require a paid subscription. By subscribing, you agree to pay the applicable fees as described at the time of purchase. All prices are in USD unless otherwise stated.",
          },
          {
            title: "Billing Cycle",
            desc: "Subscriptions are billed on a recurring basis (monthly or annually) until cancelled. You authorize Talk2Hire to charge your payment method at the start of each billing cycle.",
          },
          {
            title: "Cancellations",
            desc: "You may cancel your subscription at any time through your account settings. Cancellation takes effect at the end of the current billing period. We do not provide prorated refunds for unused periods unless required by applicable law.",
          },
          {
            title: "Price Changes",
            desc: "We reserve the right to change pricing at any time. We will provide at least 30 days' notice before any price change takes effect for existing subscribers.",
          },
          {
            title: "Taxes",
            desc: "You are responsible for all applicable taxes, levies, or duties imposed by taxing authorities. Where required, Talk2Hire will collect and remit VAT or applicable sales tax.",
          },
        ].map((item) => (
          <div key={item.title} className="border-l-2 border-gray-100 pl-4">
            <p className="text-xs font-semibold tracking-widest uppercase text-gray-700 mb-1.5">
              {item.title}
            </p>
            <p className="text-sm text-gray-500 font-light leading-relaxed">
              {item.desc}
            </p>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "disclaimers",
    number: "10",
    title: "Disclaimers & Warranties",
    content: (
      <div className="space-y-4">
        <div className="border border-gray-200 rounded-xl p-5 bg-gray-50">
          <p className="text-xs font-bold tracking-widest uppercase text-gray-700 mb-2">
            ⚠ Important Notice
          </p>
          <p className="text-sm text-gray-500 font-light leading-relaxed">
            THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT
            WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
            LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
            PURPOSE, AND NON-INFRINGEMENT.
          </p>
        </div>
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          Talk2Hire does not warrant that: (a) the Services will be
          uninterrupted or error-free; (b) defects will be corrected; (c) the
          platform is free of viruses or harmful components; or (d) the results
          obtained from using the Services will be accurate or reliable.
        </p>
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          We do not guarantee employment outcomes for candidates or successful
          hires for employers. The platform is a tool to facilitate connections
          — all hiring decisions rest with employers.
        </p>
      </div>
    ),
  },
  {
    id: "liability",
    number: "11",
    title: "Limitation of Liability",
    content: (
      <div className="space-y-4">
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          To the fullest extent permitted by applicable law, Talk2Hire and its
          officers, directors, employees, and agents shall not be liable for any
          indirect, incidental, special, consequential, or punitive damages,
          including:
        </p>
        <ul className="space-y-2">
          {[
            "Loss of profits, revenue, or anticipated savings.",
            "Loss of data or business information.",
            "Interruption of business or platform access.",
            "Loss of goodwill or reputation.",
            "Any damages arising from AI assessment outcomes or hiring decisions.",
          ].map((item) => (
            <li
              key={item}
              className="flex items-start gap-2.5 text-sm text-gray-500 font-light leading-relaxed"
            >
              <span className="mt-2 w-1 h-1 rounded-full bg-gray-300 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          Our aggregate liability for any claims arising under these Terms shall
          not exceed the greater of (a) the amount you paid to Talk2Hire in the
          12 months preceding the claim, or (b) USD $100.
        </p>
      </div>
    ),
  },
  {
    id: "indemnification",
    number: "12",
    title: "Indemnification",
    content: (
      <div className="space-y-4">
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          You agree to defend, indemnify, and hold harmless Talk2Hire and its
          affiliates, officers, directors, employees, and agents from and
          against any claims, damages, obligations, losses, liabilities, costs,
          and expenses (including reasonable legal fees) arising from:
        </p>
        <ul className="space-y-2">
          {[
            "Your use of and access to the Services.",
            "Your violation of any of these Terms.",
            "Your violation of any applicable law or regulation.",
            "Content you submit to the platform that infringes any third-party rights.",
            "Any hiring decisions you make as an employer using our platform.",
          ].map((item) => (
            <li
              key={item}
              className="flex items-start gap-2.5 text-sm text-gray-500 font-light leading-relaxed"
            >
              <span className="mt-2 w-1 h-1 rounded-full bg-gray-300 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    id: "termination",
    number: "13",
    title: "Termination",
    content: (
      <div className="space-y-5">
        <div className="border-l-2 border-gray-100 pl-4">
          <p className="text-xs font-semibold tracking-widest uppercase text-gray-700 mb-1.5">
            Termination by You
          </p>
          <p className="text-sm text-gray-500 font-light leading-relaxed">
            You may terminate your account at any time by navigating to your
            account settings and selecting "Delete Account," or by contacting us
            at{" "}
            <a
              href="mailto:support@talk2hire.com"
              className="text-gray-800 font-medium border-b border-gray-300 hover:border-gray-900 transition-colors duration-150"
            >
              support@talk2hire.com
            </a>
            . Termination does not entitle you to a refund of any fees paid.
          </p>
        </div>
        <div className="border-l-2 border-gray-100 pl-4">
          <p className="text-xs font-semibold tracking-widest uppercase text-gray-700 mb-1.5">
            Termination by Talk2Hire
          </p>
          <p className="text-sm text-gray-500 font-light leading-relaxed">
            We may suspend or terminate your account at any time, with or
            without notice, for conduct that we believe violates these Terms, is
            harmful to other users or our platform, or for any other reason at
            our sole discretion.
          </p>
        </div>
        <div className="border-l-2 border-gray-100 pl-4">
          <p className="text-xs font-semibold tracking-widest uppercase text-gray-700 mb-1.5">
            Effect of Termination
          </p>
          <p className="text-sm text-gray-500 font-light leading-relaxed">
            Upon termination, your right to use the Services ceases immediately.
            We may retain certain data as required by law or for legitimate
            business purposes as described in our Privacy Policy.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "governing-law",
    number: "14",
    title: "Governing Law & Disputes",
    content: (
      <div className="space-y-5">
        <div className="border-l-2 border-gray-100 pl-4">
          <p className="text-xs font-semibold tracking-widest uppercase text-gray-700 mb-1.5">
            Governing Law
          </p>
          <p className="text-sm text-gray-500 font-light leading-relaxed">
            These Terms shall be governed by and construed in accordance with
            the laws of the State of California, United States, without regard
            to its conflict of law provisions.
          </p>
        </div>
        <div className="border-l-2 border-gray-100 pl-4">
          <p className="text-xs font-semibold tracking-widest uppercase text-gray-700 mb-1.5">
            Dispute Resolution
          </p>
          <p className="text-sm text-gray-500 font-light leading-relaxed">
            We encourage you to contact us first at{" "}
            <a
              href="mailto:support@talk2hire.com"
              className="text-gray-800 font-medium border-b border-gray-300 hover:border-gray-900 transition-colors duration-150"
            >
              support@talk2hire.com
            </a>{" "}
            to resolve any dispute informally. If we cannot resolve a dispute
            informally within 30 days, both parties agree to submit to binding
            arbitration in San Francisco, California, under the rules of the
            American Arbitration Association.
          </p>
        </div>
        <div className="border-l-2 border-gray-100 pl-4">
          <p className="text-xs font-semibold tracking-widest uppercase text-gray-700 mb-1.5">
            Class Action Waiver
          </p>
          <p className="text-sm text-gray-500 font-light leading-relaxed">
            You agree to resolve disputes with Talk2Hire on an individual basis
            only. You waive any right to bring or participate in a class action
            lawsuit or class-wide arbitration against Talk2Hire.
          </p>
        </div>
        <div className="border-l-2 border-gray-100 pl-4">
          <p className="text-xs font-semibold tracking-widest uppercase text-gray-700 mb-1.5">
            EU & UK Users
          </p>
          <p className="text-sm text-gray-500 font-light leading-relaxed">
            If you are located in the EU or UK, nothing in these Terms affects
            your statutory rights as a consumer, including your right to bring a
            claim before a court in your country of residence.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "changes",
    number: "15",
    title: "Changes to These Terms",
    content: (
      <div className="space-y-4">
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          Talk2Hire reserves the right to update or modify these Terms at any
          time. We will notify you of material changes by:
        </p>
        <ul className="space-y-2">
          {[
            "Posting the updated Terms on this page with a new 'Last updated' date.",
            "Sending an email notification to your registered email address.",
            "Displaying a prominent notice within the platform.",
          ].map((item) => (
            <li
              key={item}
              className="flex items-start gap-2.5 text-sm text-gray-500 font-light leading-relaxed"
            >
              <span className="mt-2 w-1 h-1 rounded-full bg-gray-300 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          Your continued use of the Services after changes take effect
          constitutes your acceptance of the revised Terms. If you do not agree
          to the changes, you must discontinue use of the Services.
        </p>
      </div>
    ),
  },
  {
    id: "contact",
    number: "16",
    title: "Contact Us",
    content: (
      <div className="space-y-4">
        <p className="text-sm leading-[1.85] text-gray-500 font-light">
          If you have any questions, concerns, or feedback about these Terms and
          Conditions, please reach out to us. We aim to respond to all enquiries
          within 2 business days.
        </p>
        <div className="space-y-2">
          {[
            {
              label: "General Support",
              value: "support@talk2hire.com",
              href: "mailto:support@talk2hire.com",
            },
            {
              label: "Legal & Privacy",
              value: "support@talk2hire.com",
              href: "mailto:support@talk2hire.com",
            },
            {
              label: "Data Protection Officer",
              value: "support@talk2hire.com",
              href: "mailto:support@talk2hire.com",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="flex flex-wrap items-center gap-3 border border-gray-100 rounded-xl px-5 py-3.5"
            >
              <span className="text-xs font-semibold tracking-widest uppercase text-gray-400 w-52 shrink-0">
                {item.label}
              </span>
              <a
                href={item.href}
                className="text-sm text-gray-800 font-medium border-b border-gray-300 hover:border-gray-900 transition-colors duration-150"
              >
                {item.value}
              </a>
            </div>
          ))}
        </div>
        <p className="text-sm leading-[1.85] text-gray-500 font-light pt-2">
          Talk2Hire · United States
        </p>
      </div>
    ),
  },
];

// ── Chevron ──────────────────────────────────────────────────────────────────
const Chevron = ({ open }) => (
  <svg
    className={`w-4 h-4 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

// ── Page ─────────────────────────────────────────────────────────────────────
const Terms = () => {
  const [openSection, setOpenSection] = useState("acceptance");
  const toggle = (id) => setOpenSection(openSection === id ? null : id);

  return (
    <>
      <title>Terms &amp; Conditions | Talk2Hire</title>
      <meta
        name="description"
        content="Read Talk2Hire's Terms and Conditions governing use of our AI-powered hiring platform."
      />
      <meta name="robots" content="index, follow" />
      <link rel="canonical" href="https://talk2hire.com/terms" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,400&family=DM+Sans:wght@300;400;500&display=swap"
        rel="stylesheet"
      />

      <div
        className="min-h-screen bg-white text-gray-900"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        {/* Grid texture */}
        <div
          className="fixed inset-0 pointer-events-none z-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,0,0,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.022) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />

        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8">
          {/* ── Header Meta ── */}
          <header className="pt-14">
            <div className="flex flex-wrap items-center gap-3 mb-14">
              <span className="text-[10px] font-medium tracking-widest uppercase text-gray-400 border border-gray-200 bg-gray-50 px-3 py-1.5 rounded-full">
                Legal Document
              </span>
              <span className="w-1 h-1 rounded-full bg-gray-300" />
              <span className="text-xs text-gray-400 font-light">
                Last updated: August 7th, 2025
              </span>
              <span className="w-1 h-1 rounded-full bg-gray-300" />
              <span className="text-xs text-gray-400 font-light">
                Version 1.2
              </span>
            </div>

            {/* Hero */}
            <div className="border-t-2 border-gray-900 pt-14 pb-14 grid grid-cols-1 md:grid-cols-2 gap-12 items-end">
              <div>
                <p className="text-[10px] tracking-widest uppercase text-gray-400 font-medium mb-5">
                  Talk2Hire · Legal
                </p>
                <h1
                  className="text-6xl lg:text-7xl font-bold leading-none tracking-tight text-gray-900"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Terms &amp;
                  <span
                    className="block font-normal italic text-gray-400"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    Conditions.
                  </span>
                </h1>
              </div>
              <div>
                <p className="text-[15px] leading-relaxed text-gray-500 font-light mb-7">
                  These Terms govern your use of the Talk2Hire platform and
                  services. Please read them carefully before creating an
                  account or using our AI-powered hiring tools.
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Binding Agreement",
                    "GDPR Compliant",
                    "California Law",
                  ].map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] font-medium tracking-widest uppercase border border-gray-900 text-gray-900 px-3 py-1.5 rounded-full hover:bg-gray-900 hover:text-white transition-colors duration-200 cursor-default"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </header>

          {/* ── Summary Cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
            {[
              { icon: "📋", label: "16 Sections", sub: "Full coverage" },
              { icon: "🤖", label: "AI Terms", sub: "Interview & matching" },
              {
                icon: "💼",
                label: "Employer Rules",
                sub: "Hiring responsibilities",
              },
              {
                icon: "⚖️",
                label: "California Law",
                sub: "Arbitration clause",
              },
            ].map((card) => (
              <div
                key={card.label}
                className="border border-gray-100 rounded-2xl p-4 hover:border-gray-300 transition-colors duration-200 cursor-default"
              >
                <span className="text-2xl block mb-2">{card.icon}</span>
                <p className="text-xs font-semibold text-gray-800 leading-snug mb-0.5">
                  {card.label}
                </p>
                <p className="text-[10px] text-gray-400 font-light">
                  {card.sub}
                </p>
              </div>
            ))}
          </div>

          {/* ── Nav strip ── */}
          <nav
            className="border-t border-b border-gray-200 flex overflow-x-auto mt-6"
            style={{ scrollbarWidth: "none" }}
          >
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                className={`shrink-0 text-[11px] font-medium tracking-widest uppercase px-4 py-3.5 border-r border-gray-200 transition-colors duration-200 whitespace-nowrap outline-none
                  ${openSection === s.id ? "text-gray-900 bg-gray-50" : "text-gray-400 hover:text-gray-900 hover:bg-gray-50"}`}
              >
                {s.title}
              </button>
            ))}
          </nav>

          {/* ── Accordion ── */}
          <main className="mt-0 pb-20">
            {sections.map((section) => {
              const isOpen = openSection === section.id;
              return (
                <div
                  key={section.id}
                  id={section.id}
                  className="border-b border-gray-100 first:border-t first:border-gray-100"
                >
                  <button
                    onClick={() => toggle(section.id)}
                    className="w-full grid gap-8 md:gap-10 py-10 text-left group outline-none"
                    style={{ gridTemplateColumns: "88px 1fr" }}
                  >
                    {/* Number */}
                    <div className="pt-1">
                      <div
                        className={`text-5xl font-bold leading-none mb-3 transition-colors duration-300 select-none
                          ${isOpen ? "text-gray-900" : "text-gray-100 group-hover:text-gray-300"}`}
                        style={{ fontFamily: "'Playfair Display', serif" }}
                      >
                        {section.number}
                      </div>
                      <div
                        className={`h-0.5 transition-all duration-300
                          ${isOpen ? "w-8 bg-gray-900" : "w-4 bg-gray-200 group-hover:w-6 group-hover:bg-gray-400"}`}
                      />
                    </div>
                    {/* Title + chevron */}
                    <div className="flex items-center justify-between gap-4">
                      <h2
                        className="text-xl md:text-2xl font-semibold text-gray-900 tracking-tight"
                        style={{ fontFamily: "'Playfair Display', serif" }}
                      >
                        {section.title}
                      </h2>
                      <span
                        className={`shrink-0 w-7 h-7 rounded-full border flex items-center justify-center transition-all duration-300
                          ${
                            isOpen
                              ? "bg-gray-900 border-gray-900 text-white"
                              : "border-gray-300 text-gray-400 group-hover:border-gray-600 group-hover:text-gray-600"
                          }`}
                      >
                        <Chevron open={isOpen} />
                      </span>
                    </div>
                  </button>

                  {/* Body */}
                  {isOpen && (
                    <div
                      className="grid gap-8 md:gap-10 pb-10"
                      style={{
                        gridTemplateColumns: "88px 1fr",
                        animation: "fadeSlide .25s ease",
                      }}
                    >
                      <div />
                      <div>{section.content}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </main>

          {/* ── Quick links ── */}
          <div className="border-t border-gray-100 py-10">
            <p className="text-[10px] font-medium tracking-widest uppercase text-gray-400 mb-5">
              Related Documents
            </p>
            <div className="flex flex-wrap gap-3">
              {[
                { label: "Privacy Policy", href: "/privacy" },
                { label: "Cookie Policy", href: "/cookies" },
                {
                  label: "Privacy Notice for Candidates",
                  href: "/privacy-candidates",
                },
              ].map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-xs font-medium text-gray-600 border border-gray-200 px-4 py-2 rounded-full hover:border-gray-900 hover:text-gray-900 transition-colors duration-200"
                >
                  {link.label} →
                </a>
              ))}
            </div>
          </div>

          {/* ── Footer ── */}
          <footer className="border-t-2 border-gray-900 py-12 flex flex-wrap items-center justify-between gap-6">
            <div
              className="text-lg font-bold text-gray-900"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Talk2Hire{" "}
            </div>
            <p className="text-sm text-gray-400 font-light">
              Questions?{" "}
              <a
                href="mailto:support@talk2hire.com"
                className="text-gray-900 font-medium border-b border-gray-300 hover:border-gray-900 transition-colors duration-200"
              >
                support@talk2hire.com
              </a>
            </p>
            <p className="text-xs text-gray-300 tracking-wide">
              v1.2 · August 2025
            </p>
          </footer>
        </div>
      </div>

      <style>{`
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
};

export default Terms;
