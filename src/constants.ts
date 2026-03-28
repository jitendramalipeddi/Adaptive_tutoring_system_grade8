import { ChapterMetadata } from './types';

export const CHAPTERS: ChapterMetadata[] = [
  {
    grade: 8,
    chapter_name: "Comparing Quantities",
    chapter_id: "comparing_quantities",
    chapter_url: "/chapter/comparing-quantities",
    chapter_difficulty: 0.6,
    expected_completion_time_seconds: 3600,
    subtopics: [
      { subtopic_id: "ratios_percentages", name: "Ratios and Percentages", difficulty: 0.3 },
      { subtopic_id: "percentage_increase_decrease", name: "Percentage Increase/Decrease", difficulty: 0.4 },
      { subtopic_id: "discounts", name: "Discounts and MP/SP", difficulty: 0.4 },
      { subtopic_id: "profit_loss", name: "Profit and Loss", difficulty: 0.5 },
      { subtopic_id: "taxes_gst", name: "Taxes and GST", difficulty: 0.5 },
      { subtopic_id: "simple_interest", name: "Simple Interest", difficulty: 0.5 },
      { subtopic_id: "compound_interest", name: "Compound Interest", difficulty: 0.8 },
      { subtopic_id: "compounding_variations", name: "Compounding Variations", difficulty: 0.8 },
      { subtopic_id: "applications_compound_interest", name: "CI Applications", difficulty: 0.8 },
    ],
    prerequisites: ["grade7_ratios", "grade7_percentages"]
  },
  {
    grade: 8,
    chapter_name: "Direct and Inverse Proportions",
    chapter_id: "direct_inverse_proportion",
    chapter_url: "/chapter/direct-inverse-proportions",
    chapter_difficulty: 0.5,
    expected_completion_time_seconds: 2700,
    subtopics: [
      { subtopic_id: "introduction_variation", name: "Intro to Variation", difficulty: 0.3 },
      { subtopic_id: "direct_proportion", name: "Direct Proportion", difficulty: 0.4 },
      { subtopic_id: "testing_direct_proportion", name: "Testing Direct Proportion", difficulty: 0.4 },
      { subtopic_id: "applications_direct_proportion", name: "Direct Proportion Apps", difficulty: 0.5 },
      { subtopic_id: "inverse_proportion", name: "Inverse Proportion", difficulty: 0.6 },
      { subtopic_id: "testing_inverse_proportion", name: "Testing Inverse Proportion", difficulty: 0.6 },
      { subtopic_id: "applications_inverse_proportion", name: "Inverse Proportion Apps", difficulty: 0.7 },
    ],
    prerequisites: ["grade7_ratios", "grade6_proportions"]
  }
];
