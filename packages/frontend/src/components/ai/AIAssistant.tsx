import React, { useState, useEffect, useCallback } from "react";
import {
  LightBulbIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChatBubbleLeftEllipsisIcon,
} from "@heroicons/react/24/outline";
import { Challenge } from "../../types";
import { getAIAssistance } from "../../api/ai";

interface AIAssistantProps {
  code: string;
  challenge: Challenge;
  onSuggestionApply?: (newCode: string) => void;
}

// Define help levels and their descriptions
const HELP_LEVELS = [
  { name: "Hint", description: "A gentle nudge in the right direction" },
  { name: "Concept", description: "Explanation of relevant concepts" },
  { name: "Approach", description: "Suggested approach to solve the problem" },
  { name: "Pseudocode", description: "Solution in pseudocode" },
  { name: "Code Snippet", description: "Partial code implementation" },
];

export const AIAssistant: React.FC<AIAssistantProps> = ({
  code,
  challenge,
  onSuggestionApply,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [helpLevel, setHelpLevel] = useState(0);
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [typingEffect, setTypingEffect] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [usesMockData, setUsesMockData] = useState(false);

  // Fetch a suggestion based on the current code and help level
  const fetchSuggestion = useCallback(async () => {
    if (loading || !challenge) return;

    setLoading(true);
    setError(null);
    setThinking(true);
    setTypingEffect("");

    try {
      // First attempt to use the real API
      const response = await getAIAssistance({
        code,
        challengeSlug: challenge.slug,
        helpLevel,
        functionName: challenge.functionName,
        testCases: challenge.testCases,
      });

      const suggestionText = response.suggestion;
      setThinking(false);
      setUsesMockData(false);

      // Animate typing effect
      animateTypingEffect(suggestionText);
      setSuggestion(suggestionText);
    } catch (err) {
      console.error("Error fetching AI suggestion:", err);

      // Fallback to mock data if API fails
      const mockSuggestionText = mockSuggestion(helpLevel);
      setThinking(false);
      setUsesMockData(true);

      // Animate typing effect
      animateTypingEffect(mockSuggestionText);
      setSuggestion(mockSuggestionText);
    } finally {
      setLoading(false);
    }
  }, [loading, challenge, code, helpLevel]);

  // Helper function for typing animation
  const animateTypingEffect = (text: string) => {
    setIsTyping(true);
    let i = 0;
    const typingInterval = setInterval(() => {
      if (i <= text.length) {
        setTypingEffect(text.substring(0, i));
        i++;
      } else {
        clearInterval(typingInterval);
        setIsTyping(false);
      }
    }, 15); // Adjust speed as needed
  };

  // For development purposes - mock suggestions
  const mockSuggestion = (level: number): string => {
    const functionName = challenge.functionName;

    switch (level) {
      case 0: // Hint
        return `Think about what the ${functionName} function needs to accomplish. Look at the test cases to understand the expected behavior.`;
      case 1: // Concept
        return `This problem is testing your understanding of ${getConceptFromChallenge(
          challenge
        )}. Remember that ${getConceptDescription(challenge)}.`;
      case 2: // Approach
        return `To solve this problem, you could follow these steps:\n1. Understand the inputs and outputs\n2. ${getApproachSteps(
          challenge
        )}`;
      case 3: // Pseudocode
        return `Here's how you might structure your solution:\n\n${getPseudocode(
          challenge
        )}`;
      case 4: // Code Snippet
        return `Here's a partial implementation to get you started:\n\n${getCodeSnippet(
          challenge
        )}`;
      default:
        return "I can help you solve this challenge. What would you like to know?";
    }
  };

  // Helper functions to generate mock content based on challenge type
  const getConceptFromChallenge = (challenge: Challenge): string => {
    if (challenge.conceptTags && challenge.conceptTags.length > 0) {
      return challenge.conceptTags.join(", ");
    }
    return "basic programming concepts";
  };

  const getConceptDescription = (challenge: Challenge): string => {
    if (challenge.conceptTags?.includes("arrays")) {
      return "arrays are ordered collections of values that can be accessed by index";
    } else if (challenge.conceptTags?.includes("functions")) {
      return "functions encapsulate reusable blocks of code that can take inputs and return outputs";
    } else if (challenge.conceptTags?.includes("conditionals")) {
      return "conditional statements allow your code to make decisions based on certain conditions";
    }
    return "breaking down problems into steps is key to programming";
  };

  const getApproachSteps = (challenge: Challenge): string => {
    if (challenge.functionName === "sum") {
      return "Add the two parameters together\n3. Return the result";
    } else if (challenge.functionName === "isEven") {
      return "Check if the number is divisible by 2\n3. Return true or false accordingly";
    } else if (challenge.functionName === "reverseString") {
      return "Convert the string to an array of characters\n3. Reverse the array\n4. Join the characters back into a string";
    }
    return "Process the inputs according to the requirements\n3. Return the expected output";
  };

  const getPseudocode = (challenge: Challenge): string => {
    if (challenge.functionName === "sum") {
      return "function sum(a, b):\n  result = a + b\n  return result";
    } else if (challenge.functionName === "isEven") {
      return "function isEven(num):\n  if num % 2 equals 0:\n    return true\n  else:\n    return false";
    } else if (challenge.functionName === "reverseString") {
      return "function reverseString(str):\n  charArray = convert str to array\n  reversedArray = reverse charArray\n  reversedString = join reversedArray to string\n  return reversedString";
    }
    return "function process(input):\n  // Process input according to requirements\n  return processed result";
  };

  const getCodeSnippet = (challenge: Challenge): string => {
    if (challenge.functionName === "sum") {
      return `function sum(a: number, b: number): number {\n  // Add the two numbers\n  const result = a + b;\n  \n  // Return the sum\n  return result;\n}`;
    } else if (challenge.functionName === "isEven") {
      return `function isEven(num: number): boolean {\n  // Use the modulo operator to check if divisible by 2\n  \n  // Complete the return statement\n  return num % 2 === 0;\n}`;
    } else if (challenge.functionName === "reverseString") {
      return `function reverseString(str: string): string {\n  // One approach is to use array methods\n  // Try using split, reverse, and join\n  \n  // Your code here\n}`;
    }
    return `// Here's a starting point for your solution\n// Consider the inputs and required output`;
  };

  // Reset and toggle assistant
  const toggleAssistant = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setHelpLevel(0);
      setSuggestion("");
    }
  };

  // Get next level of help
  const increaseHelpLevel = () => {
    if (helpLevel < HELP_LEVELS.length - 1) {
      setHelpLevel(helpLevel + 1);
    }
  };

  // Get previous level of help
  const decreaseHelpLevel = () => {
    if (helpLevel > 0) {
      setHelpLevel(helpLevel - 1);
    }
  };

  // Fetch suggestion when help level changes
  useEffect(() => {
    if (isOpen) {
      fetchSuggestion();
    }
  }, [helpLevel, isOpen, fetchSuggestion]);

  // Apply suggestion to code (when applicable)
  const applySuggestion = () => {
    if (helpLevel === 4 && onSuggestionApply && suggestion) {
      // Extract code snippet between triple backticks if present
      const codeMatch = suggestion.match(/```[a-z]*\n([\s\S]*?)```/);
      const codeToInsert = codeMatch ? codeMatch[1] : suggestion;

      // Call parent component to update code
      onSuggestionApply(codeToInsert);
    }
  };

  return (
    <div className="relative">
      {/* Assistant toggle button */}
      <button
        onClick={toggleAssistant}
        className={`fixed bottom-20 right-4 p-3 rounded-full shadow-lg z-50 transition-all
        ${
          isOpen
            ? "bg-purple-600 text-white"
            : "bg-white text-purple-600 hover:bg-purple-100"
        }`}
      >
        {isOpen ? (
          <ChatBubbleLeftEllipsisIcon className="h-6 w-6" />
        ) : (
          <LightBulbIcon className="h-6 w-6" />
        )}
      </button>
      {/* Assistant panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 w-96 max-h-96 bg-gray-800 rounded-lg shadow-xl border border-purple-500/30 overflow-hidden z-50 flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4">
            <div className="flex justify-between items-center">
              <h3 className="text-white font-bold">CodeQuest Assistant</h3>
              <div className="text-xs text-white/80">
                Help Level: {helpLevel + 1}/{HELP_LEVELS.length}
              </div>
            </div>
            <div className="flex mt-2 bg-gray-900/30 rounded-lg p-1">
              {HELP_LEVELS.map((level, idx) => (
                <button
                  key={idx}
                  className={`text-xs py-1 px-2 rounded ${
                    helpLevel === idx
                      ? "bg-white text-purple-600 font-medium"
                      : "text-white/70 hover:bg-white/10"
                  }`}
                  onClick={() => setHelpLevel(idx)}
                  title={level.description}
                >
                  {level.name}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-4 flex-grow overflow-y-auto bg-gray-800">
            {error ? (
              <div className="text-red-400 text-sm">{error}</div>
            ) : thinking ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="animate-pulse text-purple-400 mb-2">
                  Thinking...
                </div>
                <div className="flex space-x-2">
                  <div
                    className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  ></div>
                </div>
              </div>
            ) : (
              <div className="prose prose-sm prose-invert max-w-none">
                <div className="text-gray-300 whitespace-pre-line">
                  {isTyping ? typingEffect : suggestion}
                  {isTyping && <span className="animate-pulse">|</span>}
                </div>

                {helpLevel === 4 && (
                  <button
                    onClick={applySuggestion}
                    className="mt-4 px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
                  >
                    Apply this code
                  </button>
                )}

                {usesMockData && (
                  <div className="mt-4 text-xs text-yellow-500/70 italic">
                    Note: Using locally generated suggestions. Connect to the AI
                    API for more tailored assistance.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-700 p-2 flex justify-between items-center">
            <div className="text-xs text-gray-400">
              {HELP_LEVELS[helpLevel].description}
            </div>
            <div className="flex space-x-1">
              <button
                onClick={decreaseHelpLevel}
                disabled={helpLevel === 0}
                className={`p-1 rounded ${
                  helpLevel === 0
                    ? "text-gray-600"
                    : "text-gray-400 hover:bg-gray-700"
                }`}
              >
                <ChevronDownIcon className="h-5 w-5" />
              </button>
              <button
                onClick={increaseHelpLevel}
                disabled={helpLevel === HELP_LEVELS.length - 1}
                className={`p-1 rounded ${
                  helpLevel === HELP_LEVELS.length - 1
                    ? "text-gray-600"
                    : "text-gray-400 hover:bg-gray-700"
                }`}
              >
                <ChevronUpIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAssistant;
