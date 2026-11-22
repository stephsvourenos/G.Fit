import { aud, plans } from "@app/config";

/**
 * Website FAQ wording. Every answer must be true of the product as built today. Check it again whenever a feature,
 * price or rule changes (no paid add-ons; casting works; phone apps aren't public yet; emails aren't switched on yet).
 */
export const FAQS = [
  ["How is G.Fit different from subscribing to one instructor?",
    "Many instructors sell their own monthly memberships or programmes. A G.Fit membership gives you the workouts and programmes of every instructor on G.Fit, in one subscription."],
  ["Is everything on G.Fit included in the membership?",
    "Yes. Every workout and programme on G.Fit is included. We don’t sell add-ons or extra programmes. Anything an instructor sells on their own website or app is separate from G.Fit."],
  ["How much does it cost?",
    `${aud(plans.monthly.amount)} a month or ${aud(plans.annual.amount)} a year, in Australian dollars with GST included. The price is the same whether it’s just you or up to ${plans.maxProfiles} people at home.`],
  ["Is there a free trial?",
    `Yes. New members get ${plans.trialDays} days free, one trial per household. You add a card, Apple Pay or Google Pay to start, and you won’t be charged if you cancel before the trial ends. After that, your plan renews automatically until you cancel.`],
  ["How do I cancel?",
    "Sign in, open your account and choose Manage membership. You can cancel online at any time and keep access until the end of the period you’ve paid for."],
  ["Can I join just for myself?",
    "Absolutely. One profile is all you need. Adding household profiles is optional, and you can do it later."],
  ["Can the people I live with use my membership?",
    `Yes. You can create up to ${plans.maxProfiles} profiles, each with its own workouts, favourites and progress. Children’s profiles need only a nickname and an age group, with no email or photo.`],
  ["Are all workouts suitable for children?",
    "No. A child’s profile only shows workouts our team has approved for their age. A parent PIN protects adult workouts, profiles and billing."],
  ["Do I need any equipment?",
    "Most workouts need nothing but some floor space. Some use a mat, a wall, a chair, a ball or light weights, and every workout lists what you’ll need before you start."],
  ["What can I watch on?",
    "Any up-to-date web browser on your phone, tablet or computer. You can also cast to your TV with AirPlay or Chromecast. Phone apps are on the way."],
] as const;
