import { Request, Response } from "express";
import User from "../models/User";
import { generateAIRecommendation } from "../utils/aiRecommend";

// Engagement Score Weights
const WEIGHTS = {
    loginCount: 0.4,
    featuresUsed: 0.3,
    recency: 0.2
};

// Function to calculate days since last login
const daysSinceLastLogin = (lastLoginDate: Date): number => {
    const today = new Date();
    const lastLogin = new Date(lastLoginDate);
    return Math.ceil((today.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24));
};

// Function to calculate Engagement Score
const calculateEngagementScore = (user: any): number => {
    const recencyScore = 1 / (1 + daysSinceLastLogin(user.last_login_date));
    const engagementScore =
        (user.number_of_logins * WEIGHTS.loginCount) +
        (user.number_of_features_used * WEIGHTS.featuresUsed) +
        (recencyScore * WEIGHTS.recency);

    return Math.min(100, Math.max(0, Math.round(engagementScore)));
};

// Function to determine Churn Risk
const calculateChurnRisk = (lastLoginDate: Date, engagementScore: number): boolean => {
    return daysSinceLastLogin(lastLoginDate) > 30 || engagementScore < 40;
};

// Function to determine Retention Category
const determineRetentionCategory = (churnRisk: boolean, engagementScore: number): string => {
    if (churnRisk) return "Low";
    if (engagementScore > 70) return "High";
    return "Medium";
};

// **📌 Improved AI Recommendation Logic**
// **📌 Improved AI Recommendation Logic with 10+ Variations**


// Function to calculate Active Users
const calculateActiveUsers = (users: any[], days: number): number => {
    return users.filter(user => daysSinceLastLogin(user.last_login_date) <= days).length;
};

// Function to calculate Retention Rate
const calculateRetentionRate = (users: any[], period: number): number => {
    const returningUsers = users.filter(user => daysSinceLastLogin(user.last_login_date) <= period).length;
    return Math.round((returningUsers / users.length) * 100);
};

// Function to get most-used and least-used features
const getFeatureUsageStats = (users: any[]) => {
    let featureUsage: Record<string, number> = {};
    users.forEach(user => {
        user.features_used?.forEach((feature: string) => {
            featureUsage[feature] = (featureUsage[feature] || 0) + 1;
        });
    });

    const sortedFeatures = Object.entries(featureUsage).sort((a, b) => b[1] - a[1]);
    return {
        mostUsedFeatures: sortedFeatures.slice(0, 3).map(([feature]) => feature),
        underperformingFeatures: sortedFeatures.slice(-3).map(([feature]) => feature),
    };
};

// Fetch users & compute engagement analytics
export const getUsers = async (req: Request, res: Response) => {
    try {
        let users = await User.find();

        // Process users asynchronously for AI recommendations
        const processedUsers = await Promise.all(
            users.map(async (user) => {
                const engagementScore = calculateEngagementScore(user);
                const churnRisk = calculateChurnRisk(user.last_login_date, engagementScore);
                const retentionCategory = determineRetentionCategory(churnRisk, engagementScore);

                // AI API Call (Handle Errors)
                let aiRecommendation;
                try {
                    aiRecommendation = await generateAIRecommendation(user, churnRisk, engagementScore);
                } catch (err) {
                    console.error("❌ AI Recommendation Failed for user:", user.name, err);
                    aiRecommendation = "Default recommendation: Increase engagement activities.";
                }

                return {
                    ...user.toObject(),
                    number_of_logins: user.number_of_logins,
                    number_of_features_used: user.number_of_features_used,
                    time_spent_on_platform: user.time_spent_on_platform,
                    engagementScore,
                    retentionCategory,
                    churnRisk,
                    aiRecommendation
                };
            })
        );

        // Compute Overview Metrics
        const overviewMetrics = {
            dailyActiveUsers: calculateActiveUsers(users, 1),
            weeklyActiveUsers: calculateActiveUsers(users, 7),
            monthlyActiveUsers: calculateActiveUsers(users, 30),
            retentionRate: calculateRetentionRate(users, 30),
            churnPredictionList: processedUsers.filter(user => user.churnRisk)
        };

        // Compute AI Insights
        const { mostUsedFeatures, underperformingFeatures } = getFeatureUsageStats(users);

        res.json({
            overviewMetrics,
            users: processedUsers,
            aiInsights: {
                mostUsedFeatures,
                underperformingFeatures,
                recommendations: processedUsers.map(user => user.aiRecommendation)
            }
        });
    } catch (error) {
        console.error("❌ Server Error:", error);
        res.status(500).json({ message: "Server Error" });
    }
};



// const generateAIRecommendation = (user: any, churnRisk: boolean, engagementScore: number): string => {
//     if (churnRisk) {
//         if (engagementScore < 10) return `🚨 Offer a free trial extension to ${user.name} (critical risk of churn).`;
//         if (engagementScore < 20) return `🎯 Provide a step-by-step tutorial to ${user.name} (very low engagement).`;
//         if (engagementScore < 30) return `⚠️ Send a limited-time discount offer to ${user.name} (low engagement).`;
//         if (engagementScore < 40) return `📩 Send a personalized "We Miss You" email to ${user.name}.`;
//         return `🔔 Notify ${user.name} about exclusive new features.`;
//     }

//     if (engagementScore < 10) return `⚠️ Guide ${user.name} to essential features using tooltips.`;
//     if (engagementScore < 20) return `📊 Show ${user.name} personalized usage stats to encourage activity.`;
//     if (engagementScore < 40) return `📈 Offer a rewards-based challenge to ${user.name} to boost engagement.`;
//     if (engagementScore < 60) return `📝 Recommend curated content to ${user.name} based on past behavior.`;
//     if (engagementScore < 80) return `🎯 Suggest advanced tutorials to ${user.name} for better usage.`;
//     return `🏆 Encourage ${user.name} to share feedback and become a power user.`;
// };