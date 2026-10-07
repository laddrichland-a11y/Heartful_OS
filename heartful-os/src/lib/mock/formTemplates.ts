// Form Library — real, digitized versions of the practitioner's intake,
// consent, and preparation paperwork. Every template flagged required+active
// auto-attaches to every new client (see createClient in src/lib/data.ts).
// Editing this file is the only thing needed to add/retire a form type.

import { FormTemplate } from "@/lib/types";

const MEDICATIONS_OPTIONS = [
  "aripiprazole / Abilify",
  "haloperidol",
  "Rifampin",
  "benzodiazepines",
  "lithium (in the past 2 weeks)",
  "Risperidone",
  "buprenorphine",
  "MAOI",
  "quetiapine / Seroquel",
  "buspirone",
  "methadone",
  "SSRI / SNRI",
  "cannabis",
  "opioids",
  "Suboxone",
  "carbamazepine",
  "olanzapine / Zyprexa",
  "Trazodone",
  "chlorpromazine",
  "phenobarbital",
  "valproic acid",
  "clozapine",
  "probenecid",
  "Ziprasidone",
].map((label) => ({ value: label, label }));

const BEHAVIORAL_HEALTH_CONDITIONS = [
  "Personal history or currently active psychosis",
  "Family history of psychosis",
  "Personality Disorder",
  "Personal history of Bipolar Disorder with Psychosis",
  "Family history of Bipolar Disorder with Psychosis",
  "Active or prior cognitive, behavioral, or developmental impairments",
  "Personal history of Schizophrenia",
  "Family history of Schizophrenia",
  "Memory or sensory processing impairments (e.g. dementia, delirium, aphasia, autism spectrum disorders)",
  "Personal history of Major Depressive Disorder with Psychosis",
  "Active or prior trauma, including physical, verbal, sexual, and emotional abuse",
  "Family history of Major Depressive Disorder with Psychosis",
  "Active Post-Traumatic Stress Disorder (PTSD)",
  "Compulsion Spectrum Disorders",
  "Active Substance Use Disorder",
].map((label) => ({ value: label, label }));

// Concrete integration practices drawn from the MAPS Integration Workbook's
// "Six Domains of Integration" (Mind, Body, Spirit, Relationships &
// Community, Nature, Lifestyle) — used on both Integration Session forms so
// a practitioner can see at a glance what a client has actually been doing,
// not just how they've been feeling.
const INTEGRATION_PRACTICES_OPTIONS = [
  "Journaling",
  "Meditation or mindfulness practice",
  "Breathwork",
  "Movement, yoga, or dance",
  "Time in nature",
  "Creative expression (art, music, writing)",
  "Body-based/somatic practices (body mapping, mindful movement)",
  "Talking with a therapist or counselor",
  "Talking with trusted friends or family",
  "Support group or integration circle",
  "Rest and reduced stimulation",
  "None of these yet",
].map((label) => ({ value: label, label }));

export function buildFormTemplates(): FormTemplate[] {
  return [
    // -------------------------------------------------------------------
    // 1. Participant Screening Form
    // -------------------------------------------------------------------
    {
      id: "tmpl_participant_screening_form",
      document_type: "participant_screening_form",
      title: "Participant Screening Form",
      description:
        "Comprehensive safety screening to determine eligibility for Natural Medicine Services, per Rules 6.15 and 6.16, 4 CCR 755-1.",
      required: true,
      active: true,
      session_types: ["intake_assessment"],
      sections: [
        {
          id: "participant_info",
          title: "Participant Information",
          fields: [
            { id: "full_name", type: "short_text", label: "Name", required: true },
            { id: "email", type: "short_text", label: "Email", required: true },
            { id: "address", type: "short_text", label: "Address", required: false },
            { id: "gender_pronouns", type: "short_text", label: "Gender / Pronouns", required: false },
            { id: "dob", type: "short_text", label: "Date of Birth", required: true },
            { id: "seeking_reason", type: "long_text", label: "Why are you seeking psychedelic-assisted therapy?", required: true },
            { id: "psychedelic_history", type: "long_text", label: "What is your history of psychedelic use or non-ordinary states of consciousness?", required: false },
            { id: "psychedelic_experience", type: "long_text", label: "What was your experience with that psychedelic use or non-ordinary states of consciousness?", required: false },
            { id: "hopes", type: "long_text", label: "What do you hope to achieve from receiving Natural Medicine Services?", required: false },
          ],
        },
        {
          id: "general_health",
          title: "A. General Health History",
          fields: [
            { id: "pregnant", type: "yes_no", label: "Are you pregnant or do you believe you could be pregnant?", helpText: "If unsure and you'd like to take a pregnancy test to avoid unnecessary exclusion, let your facilitator know.", required: true },
            { id: "breastfeeding", type: "yes_no", label: "Are you breastfeeding?", helpText: "The risks of consuming psilocybin while pregnant or breastfeeding are unknown.", required: true },
            { id: "adl_difficulties", type: "yes_no", label: "Do you have any medical conditions that cause difficulties with activities of daily living (bathing, dressing, getting in/out of bed or a chair, walking, toileting, eating)?", required: true },
            { id: "self_administration_challenges", type: "yes_no", label: "Your facilitator cannot assist with administering the medicine. Do you foresee any challenges with self-administration or swallowing?", required: true },
            { id: "walk_two_blocks", type: "yes_no", label: "Can you walk two blocks or up two flights of stairs without difficulty or getting winded?", required: true },
          ],
        },
        {
          id: "mental_health",
          title: "B. Mental Health History",
          fields: [
            { id: "self_harm_thoughts", type: "yes_no", label: "Are you having thoughts of causing harm, or wanting to cause harm, to yourself or others?", required: true },
            { id: "suicidal_thoughts_6mo", type: "yes_no", label: "Are you currently actively having thoughts of wanting your life to end or suicide in the last 6 months?", required: true },
            { id: "prior_suicide_attempt", type: "yes_no", label: "Have you had a previous suicide attempt?", required: true },
            { id: "male_3plus_drinks", type: "yes_no", label: "For males: Do you have 3+ drinks on a daily basis (21+ drinks per week)?", required: false },
            { id: "female_2plus_drinks", type: "yes_no", label: "For females: Do you have 2+ drinks on a daily basis (14+ drinks per week)?", required: false },
            { id: "depression_anxiety_diagnosis", type: "yes_no", label: "Have you ever been diagnosed with depression or anxiety?", required: true },
            { id: "abstain_substances_24_48hr", type: "yes_no", label: "Can you safely abstain from any recreational substances and medical marijuana 24–48 hours prior to treatment?", required: true },
            { id: "triggers", type: "long_text", label: "Would you like to share anything about specific behaviors, internal or external stimuli (\"triggers\") that could cause you to be uncomfortable during an administration session?", required: false },
            { id: "share_with_provider", type: "yes_no", label: "If you are currently seeing a mental healthcare provider, would you like us to communicate with them about your psychedelic-assisted therapy?", required: false },
            {
              id: "behavioral_health_conditions",
              type: "multi_select",
              label: "Have you had, or do you think you might have, any of the following behavioral health conditions? Check all that apply.",
              options: BEHAVIORAL_HEALTH_CONDITIONS,
              required: false,
            },
          ],
        },
        {
          id: "medical_history",
          title: "C. Medical History",
          fields: [
            { id: "cardiovascular", type: "yes_no", label: "Do you have a personal history or diagnosis of cardiovascular disease (high blood pressure, diabetes, irregular heartbeat/arrhythmias, heart disease, heart failure, vascular disease, chest pain/angina, clotting or bleeding disorder, heart attack, stroke, deep vein thrombosis)?", required: true },
            { id: "copd_liver_kidney", type: "yes_no", label: "Do you have COPD, liver disease, or kidney disease?", required: true },
            { id: "gastroparesis", type: "yes_no", label: "Have you ever been diagnosed with a condition that impairs your ability to absorb food through your stomach, such as gastroparesis?", required: true },
            { id: "seizure_disorder", type: "yes_no", label: "Do you have any history of seizure disorders like epilepsy, or have you ever experienced a seizure?", required: true },
            { id: "head_trauma_tbi", type: "yes_no", label: "Have you ever experienced severe head trauma or been diagnosed with a Traumatic Brain Injury?", required: true },
            { id: "malignant_hypertension_serotonin", type: "yes_no", label: "Do you have a history of malignant hypertension or serotonin syndrome?", required: true },
            { id: "hospitalized_copd_asthma", type: "yes_no", label: "Have you ever been hospitalized for COPD or asthma?", required: false },
            { id: "inhaler_oxygen", type: "yes_no", label: "Do you require use of an inhaler or supplemental oxygen during your session?", required: true },
            { id: "medical_devices", type: "long_text", label: "Do you have or use any medical devices (insulin pump, feeding tubes, IV, ostomies, drains, central lines, supplemental oxygen, dialysis, tracheostomy, pacemaker, external defibrillator, pain pump, stimulators, hearing aids, or others) that you would need to use during your session?", required: false },
            { id: "chronic_illness_other", type: "long_text", label: "Do you have another chronic illness/disorder not yet listed above that you'd like us to know about?", required: false },
            { id: "referred_by_provider", type: "long_text", label: "Have you been referred by, or consulted, another medical provider about Natural Medicine? If yes, please describe the referral and any recommended dosages.", required: false },
          ],
        },
        {
          id: "pharmacology",
          title: "D. Pharmacology",
          fields: [
            {
              id: "medications",
              type: "multi_select",
              label: "Medications: check all that you are currently taking.",
              options: MEDICATIONS_OPTIONS,
              required: false,
            },
            { id: "allergies_intolerances", type: "yes_no", label: "Do you have any allergies or intolerances to medications, supplements, foods, or smells?", required: true },
            { id: "mushroom_allergic_reaction", type: "yes_no", label: "Have you had an allergic reaction to mushrooms (psilocybin-containing or not)?", required: true },
            { id: "pharmacist_review_request", type: "yes_no", label: "Would you like a pharmacist or medical professional to look over your medication list and make recommendations prior to receiving psilocybin?", required: false },
            { id: "medications_during_session", type: "yes_no", label: "Are there any medications that you would need to take during your session? (A session may last 4–8 hours.)", required: true },
            { id: "need_help_administering_meds", type: "yes_no", label: "Will you need to administer, or need help administering, any medications during your session?", required: true },
          ],
        },
        {
          id: "additional_considerations",
          title: "E. Additional Considerations",
          fields: [
            { id: "auditory_visual_speech_accommodations", type: "yes_no", label: "Will you require accommodations for auditory, visual, or speech impairments?", required: false },
            { id: "service_animal", type: "yes_no", label: "Will you need a Service Animal (as defined by Title II and Title III of the ADA) present during your therapy session?", required: false },
            { id: "interpreter", type: "yes_no", label: "Will you require an interpreter?", required: false },
            { id: "food_drink_medical", type: "yes_no", label: "Will you require food or drink during your session as part of a medical condition?", required: false },
            { id: "spiritual_religious_accommodations", type: "yes_no", label: "Do you have any spiritual or religious accommodations you'd like us to consider?", required: false },
            { id: "other_relevant_info", type: "long_text", label: "Is there any other information not included above that you feel is relevant to share with your facilitator regarding your engagement with psilocybin treatment?", required: false },
          ],
        },
        {
          id: "attestations_end_prep",
          title: "Attestations — End of Preparation",
          body: "By the end of the preparation session, please review and initial each statement below.",
          fields: [
            { id: "complete_accurate_health_record", type: "initial", label: "I have provided a complete and accurate health record.", required: true },
            { id: "informed_of_risk_factors", type: "initial", label: "I agree that I have been provided all identified risk factors for receiving Natural Medicine Services based on my disclosed health record.", required: true },
            {
              id: "facilitator_disclosure",
              type: "static_text",
              label: "Facilitator attestation (completed by your provider): I have documented in writing the participant's full reasons for seeking access to Natural Medicine services and provided an accurate description of those services.",
              required: false,
            },
            // A "Supportive Touch Contract" attestation used to sit here, but
            // no such contract exists in the form library — the parameters of
            // physical touch are covered by the Informed Consent instead
            // (init_10). Removed rather than left pointing at a document the
            // client is never given.
            { id: "transportation_safety_plan", type: "initial", label: "I have created and reviewed a transportation safety plan for my safe discharge following administration.", required: true },
          ],
        },
        {
          id: "attestations_pre_admin",
          title: "Attestations — Pre-Administration",
          fields: [
            { id: "health_record_unchanged", type: "initial", label: "I have reviewed the health record I previously provided and attest that my answers remain unchanged.", required: true },
            { id: "health_record_update", type: "long_text", label: "If you have an update to your health record, please detail it here. Otherwise, leave blank.", required: false },
          ],
        },
        {
          id: "signature",
          title: "Participant Signature",
          body: "By signing below, I confirm that the information provided in this Participant Screening Form is true and complete to the best of my knowledge, and that I agree to the terms above.",
          fields: [{ id: "participant_signature", type: "signature", label: "Participant Signature", required: true }],
        },
      ],
    },

    // -------------------------------------------------------------------
    // 2. Informed Consent
    // -------------------------------------------------------------------
    {
      id: "tmpl_informed_consent",
      document_type: "informed_consent",
      title: "Informed Consent",
      description: "You must agree to and sign this informed consent form in order to receive services.",
      required: true,
      active: true,
      session_types: ["intake_assessment"],
      sections: [
        {
          id: "contact_info",
          title: "Client & Facilitator Information",
          fields: [
            { id: "client_name", type: "short_text", label: "Client Name", required: true },
            { id: "client_email", type: "short_text", label: "Client Email", required: true },
            { id: "client_phone", type: "short_text", label: "Client Phone", required: false },
            { id: "facilitator_name", type: "short_text", label: "Facilitator Name", required: false },
            { id: "facilitator_email", type: "short_text", label: "Facilitator Email", required: false },
            { id: "facilitator_phone", type: "short_text", label: "Facilitator Phone", required: false },
          ],
        },
        {
          id: "disclosures",
          title: "Acknowledgements",
          body: "I have been informed of and understand the following. Please initial each item below.",
          fields: [
            { id: "init_01", type: "initial", label: "I understand that psilocybin guide services do not require medical diagnosis or referral and are not a medical or clinical treatment. Any adult over the age of 21 can request and be evaluated for services.", required: true },
            { id: "init_02", type: "initial", label: "I understand that guides are trained to facilitate intakes, preparation and integration sessions, and to support psilocybin experiences using harm reduction methods. My Guide is not practicing as a legal facilitator, counselor, therapist, or doctor during the psilocybin experience.", required: true },
            { id: "init_03", type: "initial", label: "I understand that my Guide does not handle, sell, share, or provide psilocybin mushrooms or products. I am responsible for any decision to obtain psilocybin.", required: true },
            { id: "init_04", type: "initial", label: "I understand that guides may offer psilocybin-related services only as permitted under applicable state or local law, and are not operating as licensed or regulated facilitators at this time.", required: true },
            { id: "init_05", type: "initial", label: "I understand that psilocybin has not been approved by the FDA and is classified federally as a Schedule I controlled substance, despite research suggesting it is unlikely to be addictive and may improve symptoms of depression, anxiety, end-of-life distress, trauma, and problematic substance use.", required: true },
            { id: "init_06", type: "initial", label: "I understand that the risks, benefits, and drug interactions of psilocybin are not fully understood and that individual results may vary.", required: true },
            { id: "init_07", type: "initial", label: "I understand that psilocybin journeys can be challenging or uncomfortable, with possible side effects including nausea, headache, fatigue, anxiety, confusion, increased blood pressure, elevated heart rate, paranoia, perceptual changes, altered thought patterns, reduced inhibitions, recovery of repressed memories or past traumas, and altered perception of time and surroundings.", required: true },
            { id: "init_08", type: "initial", label: "I understand that if I am taking prescription medications or have a medical or mental health condition, it is recommended that I consult with an appropriate provider before participating in a session.", required: true },
            { id: "init_09", type: "initial", label: "I understand that psilocybin is derived from fungi, and if I have a known mushroom allergy, I should consult a medical or clinical provider first.", required: true },
            { id: "init_10", type: "initial", label: "I understand that facilitators may use safe, supportive touch only with my prior consent, and that my clear consent is required before any such support is offered.", required: true },
            { id: "init_11", type: "initial", label: "I understand that guides are expected to follow safe, ethical, and responsible practices and have a duty to report misconduct by any guide that harms or endangers a client.", required: true },
            { id: "init_12", type: "initial", label: "I agree to follow my agreed-upon preparation and/or safety plan and to attend recommended integration sessions.", required: true },
            { id: "init_13", type: "initial", label: "I understand that consuming psilocybin is completely voluntary and that I may decide not to consume psilocybin at any time before doing so.", required: true },
            { id: "init_14", type: "initial", label: "I understand that I have the right to update my client information and to receive a copy of it upon request.", required: true },
            { id: "init_15", type: "initial", label: "I understand that I must provide written consent if I want my client information shared with any other person or organization, except as otherwise required or permitted by law.", required: true },
            { id: "init_16", type: "initial", label: "I understand that identifying information will only be shared as permitted or required by law, including with my consent, in legal action, or when communication reveals intent to commit a crime harmful to myself or others.", required: true },
            { id: "init_17", type: "initial", label: "I understand that my Guide may take short restroom breaks during my journey.", required: true },
            { id: "init_18", type: "initial", label: "I understand that for my own safety, leaving a session during a journey once it has begun is strongly discouraged and may create safety or legal risks.", required: true },
            { id: "init_19", type: "initial", label: "I understand that I have been informed of the potential benefits, risks, and complications of psilocybin services to the extent that they are known.", required: true },
            { id: "init_20", type: "initial", label: "I understand that my Guide will identify restroom locations and explain protocols for restroom use during a journey.", required: true },
            { id: "init_21", type: "initial", label: "I acknowledge that I have had the opportunity to ask questions regarding anything I do not understand or wish to clarify.", required: true },
            { id: "init_22", type: "initial", label: "If I am participating in a group journey, I understand that I will be experiencing the effects of psilocybin in the presence of other clients, who may respond differently.", required: false },
            { id: "init_23", type: "initial", label: "I acknowledge that the risks and benefits of consuming doses greater than 35 mg of psilocybin analyte are unknown.", required: true },
            { id: "init_24", type: "initial", label: "If consuming whole fungi during an administration session, I understand that psilocybin content can vary between individual mushrooms or fruiting bodies.", required: false },
            { id: "init_25", type: "initial", label: "I understand that the risks and benefits of repeated psilocybin use are unknown.", required: true },
            { id: "init_26", type: "initial", label: "I understand that my Guide has a duty to call emergency services if required and that I am responsible for any associated costs.", required: true },
            { id: "init_27", type: "initial", label: "I understand that I will be required to identify an emergency contact and that the Guide may contact this person in the event of an emergency.", required: true },
            { id: "init_28", type: "initial", label: "I understand that I may be charged a cancellation fee if I cancel a scheduled session without adequate notice.", required: true },
            { id: "init_29", type: "initial", label: "I understand that I have the right to choose my Guide, and that if any Guide has supervisory, evaluative, or other authority over me, or a close personal or business relationship with me, it is advisable to seek services from another Guide.", required: true },
          ],
        },
        {
          id: "signature",
          title: "Signature",
          body: "By signing below, I acknowledge that I have read, understood, and voluntarily agree to all terms of this Informed Consent.",
          fields: [{ id: "client_signature", type: "signature", label: "Client Signature", required: true }],
        },
      ],
    },

    // -------------------------------------------------------------------
    // 3. Harm Reduction Services Agreement
    // -------------------------------------------------------------------
    {
      id: "tmpl_harm_reduction_services_agreement",
      document_type: "harm_reduction_services_agreement",
      title: "Harm Reduction Services Agreement",
      description: "Colorado Natural Medicine Act – Non-Licensed Facilitator Disclosure.",
      required: true,
      active: true,
      session_types: ["intake_assessment"],
      sections: [
        {
          id: "header",
          title: "Agreement Details",
          fields: [{ id: "client_name", type: "short_text", label: "Client Name", required: true }],
        },
        {
          id: "terms",
          title: "Terms",
          body:
            "1. Purpose of This Agreement. This Agreement outlines the supportive, educational, and non-clinical nature of the services provided by the Provider. The Provider offers harm-reduction education, preparation guidance, safety considerations, and post-experience integration support. The Provider does not offer psychotherapy, medical services, or licensed facilitation under the Colorado Natural Medicine Health Act (NMHA).\n\n" +
            "2. Non-Licensed Provider Disclosure. The Client acknowledges that the Provider is not a licensed facilitator and is not offering services requiring licensure under Colorado law. The Provider does not supply, administer, recommend, or supervise psilocybin or any natural medicine. The Provider's role is solely educational, supportive, and focused on safety and harm reduction. No diagnosis, treatment, or medical advice is given or implied.\n\n" +
            "3. Client's Voluntary Use of Psilocybin. The Client acknowledges that any decision to obtain, possess, or consume psilocybin is entirely voluntary and self-directed. The Provider plays no role in sourcing, distributing, administering, or encouraging the use of psilocybin. The Client understands that psilocybin may involve psychological, emotional, and physical risks and accepts sole responsibility for any consequences arising from its use.\n\n" +
            "4. Nature of Services. The Provider may offer educational information regarding harm reduction, set and setting preparation, emotional regulation tools, grounding practices, breathwork, and non-clinical integration support. These services are supportive only and are not substitutes for medical, psychological, or emergency care. The Provider does not administer psilocybin or provide therapeutic guarantees.\n\n" +
            "5. No Guarantee of Outcome. The Client acknowledges that psilocybin experiences are highly individual, unpredictable, and may include challenging psychological or emotional content. The Provider does not guarantee or suggest any particular outcome, insight, or benefit.\n\n" +
            "6. Client Health and Safety Responsibility. The Client agrees to disclose any relevant medical or mental health history that may affect safety, to seek medical or psychological care when appropriate, to avoid alcohol or other substances, and to arrange safe transportation. The Provider assumes no responsibility for the Client's physical safety or personal decisions.\n\n" +
            "7. Legal Acknowledgment. The Client understands psilocybin remains illegal under federal law. Nothing in this Agreement constitutes legal advice or an endorsement of unlawful behavior. The Provider does not possess, handle, or store psilocybin.\n\n" +
            "8. Hold Harmless and Release of Liability. The Client agrees to fully release, indemnify, and hold harmless the Provider from any and all liabilities, claims, damages, losses, or injuries — emotional, psychological, physical, or legal — arising from the Client's use of psilocybin, participation in preparation or integration sessions, or any actions taken before, during, or after psilocybin use.\n\n" +
            "9. Confidentiality. The Provider agrees to maintain confidentiality to the extent permitted by Colorado law, except where disclosure is required due to risk of harm to self or others, or abuse involving minors or vulnerable individuals.",
          fields: [],
        },
        {
          id: "acknowledgment",
          title: "Acknowledgment & Signature",
          body: "By signing below, the Client affirms that they have read, understood, and voluntarily agree to all terms of this Agreement free of coercion.",
          fields: [{ id: "client_signature", type: "signature", label: "Client Signature", required: true }],
        },
      ],
    },

    // -------------------------------------------------------------------
    // 4. Client Services Agreement
    // -------------------------------------------------------------------
    {
      id: "tmpl_client_services_agreement",
      document_type: "client_services_agreement",
      title: "Client Services Agreement",
      description: "Colorado – Non-Licensed Natural Medicine Support Services.",
      required: true,
      active: true,
      session_types: ["intake_assessment"],
      sections: [
        {
          id: "header",
          title: "Agreement Details",
          fields: [{ id: "client_name", type: "short_text", label: "Client Name", required: true }],
        },
        {
          id: "terms",
          title: "Terms",
          body:
            "1. Purpose and Scope of Services. Provider offers non-clinical, non-medical, and non-therapeutic services.\n\n" +
            "2. Provider Is Not a Licensed Facilitator Under NMHA. Provider is not a licensed psilocybin facilitator, does not administer psilocybin, and provides harm-reduction services only.\n\n" +
            "3. No Supply or Administration of Psilocybin. Provider does not supply or administer psilocybin.\n\n" +
            "4. Client Responsibilities. Provide truthful information, communicate openly, seek medical care when appropriate, and arrange safe transportation.\n\n" +
            "5. Risks and Unknowns. Psilocybin may involve emotional and physical risks.\n\n" +
            "6. Confidentiality. Provider maintains confidentiality except where required by law.\n\n" +
            "7. Emergency Situations. Provider is not a medical provider.\n\n" +
            "8. Release of Liability. Client releases Provider from liability related to independent psilocybin use.\n\n" +
            "9. Payment, Cancellations, and Refunds. Client agrees to pay fees; cancellations may incur charges.",
          fields: [],
        },
        {
          id: "fees",
          title: "Fee for Services",
          body: "The fee for services includes one (1) 90-minute preparation session, one (1) 60-minute preparation session, one (1) eight-hour harm-reduction session, and two (2) 60-minute integration sessions.",
          // The fee autofills from the client's package value (Client.package_value,
          // set on the client record) — so no hardcoded amount here.
          fields: [
            {
              id: "total_fee",
              type: "fee",
              label: "Total Fee",
              helpText: "Set from this client's package value on their client record.",
              required: true,
            },
          ],
        },
        {
          id: "acknowledgment",
          title: "Acknowledgment & Signature",
          body: "By signing below, Client acknowledges full understanding and agreement with this Client Services Agreement.",
          fields: [{ id: "client_signature", type: "signature", label: "Client Signature", required: true }],
        },
      ],
    },

    // -------------------------------------------------------------------
    // 5. Preparing a Plan for Your Journey
    // -------------------------------------------------------------------
    {
      id: "tmpl_preparation_navigation_plan",
      document_type: "preparation_navigation_plan",
      title: "Preparing a Plan for Your Journey",
      description: "Start a journal today and add a few notes each day as your session approaches.",
      required: true,
      active: true,
      session_types: ["preparation"],
      sections: [
        {
          id: "intentions",
          title: "Setting Your Intentions",
          fields: [
            { id: "important_intentions", type: "long_text", label: "What feels most important for you to focus on going into this experience?", required: true },
            { id: "goals", type: "long_text", label: "Is there anything specific you're hoping to work through or move toward?", required: false },
            { id: "questions", type: "long_text", label: "What questions are you carrying that you'd like this journey to shed some light on?", required: false },
            { id: "things_to_let_go_of", type: "long_text", label: "What would you like to set down or release for this experience?", required: false },
          ],
        },
        {
          id: "comfort",
          title: "What Helps You Feel Grounded",
          fields: [
            { id: "reassuring_statements", type: "long_text", label: "What words or reminders tend to settle you when things feel uncertain?", required: false },
            { id: "what_you_love_most", type: "long_text", label: "Who or what matters most to you — what do you love?", required: false },
            { id: "helps_let_go_of_fear", type: "long_text", label: "What usually helps you move through fear when it shows up?", required: false },
            { id: "favorite_way_to_relax", type: "long_text", label: "How do you naturally unwind or relax?", required: false },
          ],
        },
        {
          id: "concerns_expectations",
          title: "Concerns, Expectations, and What You're Bringing In",
          fields: [
            { id: "concerns", type: "long_text", label: "Is there anything about this experience that worries you?", required: false },
            { id: "preconceptions", type: "long_text", label: "What ideas or assumptions do you already carry about psychedelic or plant-medicine experiences?", required: false },
            { id: "understanding_mystical_experience", type: "long_text", label: "Have you come across terms like mystical experience or expanded consciousness before? What's your understanding of them?", required: false },
            { id: "expectations_hopes", type: "long_text", label: "What are you hoping for, and what do you expect this session might be like?", required: false },
          ],
        },
        {
          id: "setting_preferences",
          title: "Shaping Your Setting",
          fields: [
            { id: "wants_eyeshade_headset_music", type: "yes_no", label: "Would an eye covering, headphones, and a music playlist support your experience?", required: false },
            { id: "wants_scented_diffuser", type: "yes_no", label: "Would you like a scent diffuser running?", required: false },
            {
              id: "diffuser_scent",
              type: "select",
              label: "Is there a particular scent you're drawn to?",
              helpText: "Only needed if you'd like the diffuser running.",
              required: false,
              options: [
                { value: "lavender", label: "Lavender" },
                { value: "tea_tree", label: "Tea Tree" },
                { value: "orange", label: "Orange" },
                { value: "peppermint", label: "Peppermint" },
                { value: "lemongrass", label: "Lemongrass" },
                { value: "eucalyptus", label: "Eucalyptus" },
                { value: "other", label: "Other / something else" },
              ],
            },
            { id: "diffuser_scent_other", type: "short_text", label: "If you chose \"Other,\" what scent?", required: false },
            { id: "altar_items", type: "long_text", label: "Is there anything meaningful you'd like placed nearby to hold your intentions — photos, objects, symbols?", required: false },
            { id: "consumption_method", type: "short_text", label: "How would you prefer to take your medicine? (whole, ground, brewed as tea, capsules, etc.)", required: false },
            { id: "anything_else", type: "long_text", label: "Anything else worth noting before your session?", required: false },
            { id: "dose_desired", type: "short_text", label: "Desired dose", required: false },
          ],
        },
        {
          id: "acknowledgment",
          title: "Acknowledgment & Signature",
          body: "By signing below, I confirm that everything I've shared in this preparation plan is accurate and complete to the best of my knowledge.",
          fields: [{ id: "client_signature", type: "signature", label: "Client Signature", required: true }],
        },
      ],
    },

    // -------------------------------------------------------------------
    // 6. Integration Session 1 — Reflection Form
    //
    // Structure follows the MAPS Integration Workbook's "Six Domains of
    // Integration" (Mind, Body, Spirit, Relationships & Community, Nature,
    // Lifestyle), weighted toward the domains that matter most in the days
    // immediately following a journey (Mind, Body, safety/aftereffects) —
    // consistent with the MAPS MDMA-assisted therapy protocol, where the
    // first integration session happens within a day or two of the journey
    // and focuses on processing and meaning-making while the experience is
    // still fresh, plus a check for normal short-term aftereffects.
    // -------------------------------------------------------------------
    {
      id: "tmpl_integration_session_1",
      document_type: "integration_session_1",
      title: "Integration Session 1 — Reflection Form",
      description: "Reflect on your journey experience before your first integration session, within the first days after your journey.",
      required: true,
      active: true,
      session_types: ["integration_1"],
      sections: [
        {
          id: "orientation",
          title: "Before You Begin",
          body: "Integration is the process of making sense of your journey and carrying its insights into daily life — it doesn't happen all at once, and it doesn't happen automatically. This first check-in is about capturing what's still fresh: what you remember, what you're feeling, and how your body and mind have been since. It's common to feel physically tired, a little foggy, or to notice your mood dip in the first few days — for most people that eases within about a week. If anything feels like more than that, or like it isn't easing, say so below; that's exactly what this check-in is for.",
          fields: [],
        },
        {
          id: "aftereffects_check",
          title: "Safety & Aftereffects Check",
          fields: [
            { id: "physical_state", type: "long_text", label: "How have you been feeling physically since your journey — energy, sleep, appetite, anything unusual?", required: false },
            { id: "sleep_dreams", type: "long_text", label: "How has your sleep been? Have you had any notable dreams?", required: false },
            { id: "any_concerns", type: "yes_no", label: "Is there anything about how you've been feeling — physically or emotionally — that concerns you or feels like it needs support sooner than this session?", required: true },
            { id: "concerns_detail", type: "long_text", label: "If yes, tell us more so we can follow up.", required: false },
            { id: "support_people", type: "long_text", label: "Who have you talked to or leaned on since your journey?", required: false },
          ],
        },
        {
          id: "remembering",
          title: "Remembering & Reflecting on the Experience",
          body: "Take about 10 minutes to write a brief description of your journey — what you remember, what stood out, and how it related to what you were hoping to explore.",
          fields: [
            { id: "journey_description", type: "long_text", label: "Describe your journey — the overall feeling, and what emotions, thoughts, or sensations stood out most", required: false },
            { id: "intention_response", type: "long_text", label: "You set an intention before your journey — how did the experience respond to it (directly, unexpectedly, or not at all)?", required: false },
            { id: "symbols_visuals", type: "long_text", label: "Were there any images, symbols, or visuals that stood out? What do you think they might relate to?", required: false },
            { id: "most_significant", type: "long_text", label: "What was the most significant or meaningful part of your journey?", required: true },
            { id: "unresolved", type: "long_text", label: "Is there anything from the journey that feels unresolved, confusing, or difficult?", required: false },
          ],
        },
        {
          id: "mind_body",
          title: "Mind & Body",
          body: "Psychedelic experiences often shift how present we feel in our own bodies, and how we relate to our own thoughts. Both are worth noticing on their own.",
          fields: [
            { id: "thought_shifts", type: "long_text", label: "Have you noticed any shifts in your thought patterns, self-talk, or the way you're able to observe your own thinking?", required: false },
            { id: "body_sensations", type: "long_text", label: "As you recall the journey, what do you notice in your body right now? Any lasting sensations, tension, or ease?", required: false },
            { id: "recurring_themes", type: "long_text", label: "What themes, images, or feelings keep coming up for you since the journey ended?", required: false },
          ],
        },
        {
          id: "practices",
          title: "Integration Practices So Far",
          body: "None of these are required — this just helps us understand what's already supporting you.",
          fields: [
            { id: "practices_tried", type: "multi_select", label: "Which of these have you engaged in since your journey?", options: INTEGRATION_PRACTICES_OPTIONS, required: false },
            { id: "practices_notes", type: "long_text", label: "Anything you'd add about what's been helping (or not helping) so far?", required: false },
          ],
        },
        {
          id: "looking_ahead",
          title: "Looking Ahead to This Session",
          fields: [
            { id: "commitments", type: "long_text", label: "What commitments or intentions have emerged from your journey that you want to carry forward?", required: false },
            { id: "support_needed", type: "long_text", label: "What support do you need most right now?", required: false },
            { id: "questions", type: "long_text", label: "What questions or topics would you most like to explore in this integration session?", required: false },
          ],
        },
      ],
    },

    // -------------------------------------------------------------------
    // 7. Integration Session 2 — Reflection Form
    //
    // In the MAPS protocol, later integration sessions serve two purposes:
    // continuing integration, and taking stock of what's actually carried
    // through into daily life. This form leans into the Six Domains that
    // matter most further out from the journey — Lifestyle, Relationships &
    // Community, and Spirit/meaning — alongside a direct check on which
    // earlier commitments actually stuck, since sustained behavior change
    // (not just insight) is where MAPS locates the real integration work.
    // -------------------------------------------------------------------
    {
      id: "tmpl_integration_session_2",
      document_type: "integration_session_2",
      title: "Integration Session 2 — Reflection Form",
      description: "Reflect on your integration progress since your first integration session — this is the final step before your Growth Action Plan.",
      required: true,
      active: true,
      session_types: ["integration_2"],
      sections: [
        {
          id: "orientation",
          title: "Before You Begin",
          body: "Some weeks have passed since your journey. The heightened openness to change that follows a journey doesn't last forever, so this check-in is less about the experience itself and more about what's actually taken root — what's become part of daily life, what's been harder to sustain, and what still needs attention. Be honest about both: what stuck and what didn't tells us just as much.",
          fields: [],
        },
        {
          id: "progress",
          title: "Integration Progress",
          fields: [
            { id: "overall_progress", type: "long_text", label: "How has your integration been progressing since our last session?", required: true },
            { id: "insights_landed", type: "long_text", label: "Which insights or realizations from your journey have become clearer or more meaningful over time?", required: false },
            { id: "challenges", type: "long_text", label: "What has still felt challenging or difficult to integrate?", required: false },
          ],
        },
        {
          id: "lifestyle_body",
          title: "Lifestyle & Body",
          body: "Consider any rituals, routines, or habits — sleep, movement, food, daily structure — that support your wellbeing, or that you've felt called to change.",
          fields: [
            { id: "life_changes", type: "long_text", label: "What concrete changes have you made or noticed in your daily habits or routines?", required: false },
            { id: "body_wellbeing", type: "long_text", label: "Have you noticed any lasting shifts in energy, mood, or how you feel in your body day to day?", required: false },
            { id: "practices_ongoing", type: "multi_select", label: "Which practices have you kept up since your last session?", options: INTEGRATION_PRACTICES_OPTIONS, required: false },
          ],
        },
        {
          id: "relationships_spirit",
          title: "Relationships, Community & Meaning",
          body: "Integration often shows up most clearly in how we relate to other people — and, for some, in a shifted sense of meaning or connection to something larger.",
          fields: [
            { id: "relationship_impact", type: "long_text", label: "Has anything shifted in your relationships — with friends, family, or partners — since your journey?", required: false },
            { id: "community_support", type: "long_text", label: "Do you have people or spaces where you feel safe sharing about this experience?", required: false },
            { id: "meaning_spirit", type: "long_text", label: "Have you noticed any shift in your sense of meaning, purpose, or connection to something bigger than yourself? (Optional — answer only if this resonates.)", required: false },
          ],
        },
        {
          id: "commitments_review",
          title: "Commitments Review",
          fields: [
            { id: "commitments_kept", type: "long_text", label: "Which of the commitments or intentions from our first integration session have you been able to act on?", required: false },
            { id: "commitments_hard", type: "long_text", label: "Which have been harder to put into practice, and what's gotten in the way?", required: false },
          ],
        },
        {
          id: "looking_ahead",
          title: "Looking Ahead",
          body: "After this session, we'll put together your Growth Action Plan together, building on everything you've reflected on across both integration sessions.",
          fields: [
            { id: "still_unresolved", type: "long_text", label: "Is there anything that still feels unresolved from the journey or your integration so far?", required: false },
            { id: "ongoing_practices", type: "long_text", label: "What ongoing practices or supports feel most important for you to maintain going forward?", required: false },
            { id: "future_journey", type: "yes_no", label: "Do you feel drawn to another journey at some point in the future?", required: false },
            { id: "future_journey_timing", type: "long_text", label: "If yes, what feels right about the timing or intention?", required: false },
            { id: "final_reflections", type: "long_text", label: "Any final reflections, gratitude, or questions you want to bring into this session?", required: false },
          ],
        },
      ],
    },

    // -------------------------------------------------------------------
    // 8. Preparation Education Session
    // -------------------------------------------------------------------
    {
      id: "tmpl_preparation_education_session",
      document_type: "preparation_education_session",
      title: "Preparation Education Session",
      description: "Phases of the journey, what to expect, and how to work with your guide.",
      required: true,
      active: true,
      session_types: ["preparation"],
      sections: [
        {
          id: "phase_1",
          title: "Phase One: The Medicine Ceremony",
          body: "The journey starts with a ceremony to state your intentions, ask to be open to whatever happens, and consume your medicine. After you drink your tea or consume the psilocybin, you will be waiting to begin your journey. If you feel any anxiety, let the guide know. When you begin to feel the experience begin, you will want to lie down, put on your eyeshade, and listen to your music. Your guide will sit next to you and can hold your hand as your journey begins if you wish.",
          fields: [],
        },
        {
          id: "phase_2",
          title: "Phase Two: Entheogenic Integration (20 minutes to 1 hour)",
          body: "You may begin to feel anxiety, a faster heart rate, and mild to moderate stress as the medicine kicks in. This is normal and it will pass. If you feel especially fearful, talk to your guide — they will help you relax and remind you this is only an initial reaction that will shift.\n\nYou may feel nausea. If you need to vomit, tell your guide; they will have a bin nearby and will support you. Deep breathing can help. You may begin to feel that you are moving in and out of awareness of being in the room or falling into a trance-like state. You may feel like laughing, which is a good sign. You may feel afraid or nervous — all of these are signs that your journey has begun. This is the time to lie down, put on your mask and headphones, and listen to the music.\n\nIf you become concerned with anything you are experiencing, share this with your guide, or simply put out your hand and ask for it to be held. Relax and observe but do not try to control the flow of images and sensations. Affirm: all experiences are welcome.\n\nA rush of thoughts and images may begin to arise. Step back and observe these. If for any reason you feel extremely uneasy, tell your guide.",
          fields: [],
        },
        {
          id: "phase_3",
          title: "Phase Three: Letting Go and Opening Up (2–4 hours)",
          body: "During this phase you will experience deep insights and understandings, and let go of thoughts, feelings, and concerns you don't need for this journey or your life. The music will continue unless you ask for silence. After 3 hours, you will reach the halfway point of the journey.\n\nThis can be effortless and ecstatic, or it can be disorienting — embrace whatever is happening, knowing it will change. You may feel resistance to surrendering; if uncertain, tell your guide.\n\nYou may feel physical distortions that are not really happening, or wonder if you are safe. If distressing, tell your guide what is going on — they will remind you that these are inner experiences of your mind, your body is fine, and your inner self will help you ride through this.\n\nYou may feel boundaries dissolving, or the presence of spirits or beings — these encounters are typically positive, but tell your guide if anything disturbs you. If you need water at any time, ask your guide.",
          fields: [],
        },
        {
          id: "phase_4",
          title: "Phase Four: Plateau (1–2 hours)",
          body: "After your journey reaches plateau, music is optional and your guide may gradually lower the volume. This is a good time to sit up, check in with your guide, or continue listening to music.\n\nYou can enjoy watching the ever-changing images and shifting realities. If you need reassurance that your experience is really happening, ask your guide.\n\nYou will gradually return to a less powerful state, though your external visual field may still be in flux. Near the end of this phase you may wish to go outdoors; your guide will help you stand and walk safely. If you need the restroom, tell your guide so they can walk with you.",
          fields: [],
        },
        {
          id: "phase_5",
          title: "Phase Five: Coming Down to Earth (up to 3 hours)",
          body: "After the peak experience, you will begin to re-enter the world and reflect on your personal work, with enhanced awareness and sensory sensitivity. This is an ideal time to go outdoors, look at flowers your guide provides, or look at yourself in a mirror — this experience will be unique to you.\n\nIt will help to spend time looking at the photos and symbolic items on your intention altar, listen to music, start writing in your journal, and review and re-read your intentions out loud. If you feel hungry or thirsty, tell your guide — they will have snacks and water nearby.",
          fields: [],
        },
        {
          id: "phase_6",
          title: "Phase Six: After the Journey",
          body: "For the rest of the evening you may drift in and out of non-ordinary consciousness and feel great love for family and loved ones. Some parts of the journey may be hard to recall, but the major events will stay with you over the coming weeks, months, and years.\n\nThis is a good time for your initial integration session, writing about your experience, eating lightly, and drinking plenty of water. A cup of relaxing herbal tea can help you sleep. You may have vivid dreams the first night and subsequent nights — write them in your journal and bring them to your follow-up integration sessions.",
          fields: [],
        },
        {
          id: "post_journey",
          title: "Post-Journey Integration & Next Steps",
          body: "In the days after your journey, your guide will walk you through your initial integration session, focusing on your experience and any intentions that showed up. It will likely take a few weeks to distill the most important aspects of your journey — don't be in a hurry. Be discerning about who you share your experience with.\n\nDo not make any major life decisions or changes in the first few weeks after your session (healthy changes like diet, exercise, and dropping toxic behaviors are excluded). You will likely feel more sensitive and aware day-to-day, which is typically a good feeling.\n\nWithin 3–4 days of your journey, you will meet with your guide for your first post-journey integration session to review intentions, talk about experiences, and share insights. Additional integration sessions may be recommended to continue your process of growth. It may be beneficial to repeat a natural medicine journey at some point; your guide will discuss timing with you.",
          fields: [],
        },
        {
          id: "possible_experiences",
          title: "Possible Psychedelic Experiences",
          body:
            "There can be many different sensory, energy, and body sensations during a sacred medicine journey, including: alteration of felt time; cascading geometric forms, colors, or lights; experiencing your own birth; remembering different deaths or past events; finding yourself in a different reality; being in a different body or experiencing distortions of your own body; hearing colors or seeing sounds; visions of creatures or beings; ecstasy or sexual energy; remembering trauma or painful experiences; mystical and spiritual experiences; encountering spirits or entities (usually positive — tell your guide if upset or frightened); experience of unity or oceanic boundlessness; transcendence of time, space, body, and mind; insight into patterns, fears, anger, or grief; leaving the body and traveling in the spirit realm; merging with rocks, animals, plants, people, or environments; being overwhelmed by feelings and emotions; and feeling excited, joyous, blissful, and elevated.\n\nRemember: your journey is one-of-a-kind and relates to what is inside of you, revealing what you need to know to become more aware, caring, and connected with yourself, your loved ones, and all living things.",
          fields: [],
        },
        {
          id: "acknowledgment",
          title: "Acknowledgment & Signature",
          body: "By signing below, I confirm that I have read and reviewed this Preparation Education Session material and understand what to expect during the phases of my journey.",
          fields: [{ id: "client_signature", type: "signature", label: "Client Signature", required: true }],
        },
      ],
    },

    // -------------------------------------------------------------------
    // 9. 12-Hour Check-In
    // -------------------------------------------------------------------
    {
      id: "tmpl_check_in_12hr_form",
      document_type: "check_in_12hr_form",
      title: "12-Hour Check-In",
      description: "How things feel about 12 hours after the journey — filled in by the client or during the check-in call.",
      required: true,
      active: true,
      session_types: ["check_in_12hr"],
      sections: [
        {
          id: "check_in",
          title: "How are you doing?",
          body: "Take your time. There are no right answers — this just helps your guide support you well over the next few days.",
          fields: [
            { id: "emotional_state", type: "long_text", label: "Emotional state — how are you feeling emotionally?" },
            { id: "physical_state", type: "long_text", label: "Physical state — how is your body feeling (sleep, appetite, energy)?" },
            { id: "immediate_insights", type: "long_text", label: "Immediate insights — anything from the journey that's staying with you?" },
            { id: "support_needs", type: "long_text", label: "Support needs — what would help you right now?" },
            { id: "safety_concerns", type: "long_text", label: "Safety concerns — anything worrying you, or anything your guide should know?" },
          ],
        },
      ],
    },
  ];
}
