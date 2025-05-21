// generate-docs.js - API Documentation Generator

// This script generates API documentation files based on a configuration file and OpenAPI specification.
// It uses the Anthropic API to generate content for the files and organizes them into a specified directory structure.
// The script handles both AI-generated and non-AI-generated files, allowing for flexibility in documentation creation.
// It also includes error handling and logging to track the progress of the documentation generation process.
// The generated files are formatted in Markdown with Jekyll front matter, making them suitable for static site generation.
// The script is designed to be run in a Node.js environment and requires the necessary dependencies to be installed.
// 
// Usage: node scripts/generate-docs.js

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const Anthropic = require('@anthropic-ai/sdk');
const SwaggerParser = require('@apidevtools/swagger-parser');

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Constants
const CONFIG_PATH = '/doc_support/_ai_doc_set.yaml';
const DOCS_OUTPUT_DIR = '/docs';

// This limits the topics to generate to a specific set for testing purposes

// Test mode configuration
const TEST_MODE = process.env.TEST_MODE === 'true'; // Default to false if not specified
console.log(`Running in ${TEST_MODE ? 'TEST MODE' : 'FULL GENERATION MODE'}`);
const TOPICS_TO_TEST = [
  'index.md',
  'getting-started.md',
  'api-reference/get-all-tasks.md'  // One API endpoint as example
];

async function main() {
  console.log(`Running in ${TEST_MODE ? 'TEST MODE' : 'FULL GENERATION MODE'}`);
  
  console.log('Loading configuration...');
  const config = await loadConfig();
  
  console.log('Fetching OpenAPI specification...');
  const apiSpec = await fetchOpenApiSpec(config.global.apiSpec);
  
  console.log('Creating directory structure...');
  await createDirectoryStructure(config);
  
  console.log('Generating documentation files...');
  await generateDocumentationFiles(config, apiSpec);
  
  console.log('Documentation generation complete!');
}

async function loadConfig() {
  const configFile = await fs.readFile(CONFIG_PATH, 'utf8');
  return yaml.load(configFile);
}

async function fetchOpenApiSpec(specUrl) {
  try {
    // Parse and validate the OpenAPI spec
    const api = await SwaggerParser.validate(specUrl);
    console.log(`API name: ${api.info.title}, Version: ${api.info.version}`);
    return api;
  } catch (err) {
    console.error('Error parsing OpenAPI spec:', err);
    throw err;
  }
}

async function createDirectoryStructure(config) {
  // Create root docs directory if it doesn't exist
  await fs.mkdir(DOCS_OUTPUT_DIR, { recursive: true });
  
  // Create directories for each section
  for (const section of config.content.sections) {
    const sectionPath = path.join(DOCS_OUTPUT_DIR, section.directory);
    await fs.mkdir(sectionPath, { recursive: true });
  }
}

async function generateDocumentationFiles(config, apiSpec) {
  // Generate root topic files
  const rootTopicsToGenerate = TEST_MODE 
    ? config.content.topics.filter(topic => TOPICS_TO_TEST.includes(topic.filename))
    : config.content.topics;
  
  console.log(`Generating ${rootTopicsToGenerate.length} root topics...`);
  for (const topic of rootTopicsToGenerate) {
    await generateFile(topic, config, apiSpec, DOCS_OUTPUT_DIR);
  }
  
  // Generate section topic files
  for (const section of config.content.sections) {
    const sectionPath = path.join(DOCS_OUTPUT_DIR, section.directory);
    
    let sectionTopicsToGenerate = section.topics;
    
    // Filter topics in test mode
    if (TEST_MODE) {
      sectionTopicsToGenerate = section.topics.filter(topic => {
        const fullPath = `${section.directory}/${topic.filename}`;
        return TOPICS_TO_TEST.includes(fullPath);
      });
    }
    
    console.log(`Generating ${sectionTopicsToGenerate.length} topics for section: ${section.title}...`);
    
    for (const [index, topic] of sectionTopicsToGenerate.entries()) {
      // Replace $pos placeholder with the 1-based index
      if (topic.frontMatter.nav_order === "$pos") {
        topic.frontMatter.nav_order = `${index + 1}`;
      }
      
      await generateFile(topic, config, apiSpec, sectionPath, section);
    }
  }
}

async function generateFile(topic, config, apiSpec, outputDir, section = null) {
  console.log(`Generating file: ${topic.filename}`);
  
  // Replace $today placeholder with current date
  const today = new Date().toISOString().split('T')[0];
  Object.keys(topic.frontMatter).forEach(key => {
    if (typeof topic.frontMatter[key] === 'string') {
      topic.frontMatter[key] = topic.frontMatter[key].replace('$today', today);
    }
  });
  
  // Skip AI generation for non-AI-generated files
  if (topic.frontMatter['ai-generated'] === false) {
    await writeFile(topic, outputDir, generateOutlineTemplate(topic, section));
    return;
  }
  
  // Create a file-specific prompt
  const prompt = createPromptForFile(topic, config, apiSpec, section);
  
  // Generate content using Claude API
  const content = await generateContentWithClaude(prompt, config.global.aiModel);
  
  // Write the file
  await writeFile(topic, outputDir, content);
}

function createPromptForFile(topic, config, apiSpec, section) {
  // Base prompt from config
  let prompt = config.global.aiPrompt;
  
  // Add file-specific context
  prompt += `\n\n## FILE CONTEXT\nYou are generating a single file: ${topic.filename}`;
  prompt += `\nTitle: ${topic.frontMatter.title}`;
  prompt += `\nDescription: ${topic.frontMatter.description}`;
  
  if (section) {
    prompt += `\nSection: ${section.title}`;
    prompt += `\nPurpose: ${section.purpose}`;
    prompt += `\nAudience: ${section.audience}`;
    prompt += `\nReader Level: ${section.readerLevel}`;
  }
  
  // Add relevant API endpoints if specified
  if (topic.frontMatter.api_endpoints) {
    prompt += `\n\n## RELEVANT API ENDPOINTS`;
    for (const endpoint of topic.frontMatter.api_endpoints) {
      prompt += `\n- ${endpoint}`;
      
      // Find endpoint details in OpenAPI spec
      const path = apiSpec.paths[endpoint];
      if (path) {
        Object.keys(path).forEach(method => {
          prompt += `\n  - ${method.toUpperCase()}: ${path[method].summary || ''}`;
        });
      }
    }
  }
  
  // Add output format instructions
  prompt += `\n\n## OUTPUT FORMAT`;
  prompt += `\nGenerate a complete markdown file with Jekyll front matter.`;
  prompt += `\nFront matter should be enclosed in "---" at the top of the file.`;
  
  // Add section structure if specified
  if (section && section.topicSections) {
    prompt += `\n\nInclude the following sections in order:`;
    for (const sectionName of section.topicSections) {
      prompt += `\n- ${sectionName}`;
    }
  }
  
  return prompt;
}

async function generateContentWithClaude(prompt, model) {
  try {
    console.log('Sending request to Claude API...');
    const response = await anthropic.messages.create({
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 4000,
      messages: [
        { role: "user", content: prompt }
      ]
    });
    
    return response.content[0].text;
  } catch (error) {
    console.error('Error generating content with Claude:', error);
    throw error;
  }
}

function generateOutlineTemplate(topic, section) {
  // Create a template for non-AI-generated files
  let content = `---\n`;
  
  // Add front matter
  Object.entries(topic.frontMatter).forEach(([key, value]) => {
    content += `${key}: ${typeof value === 'string' ? `"${value}"` : value}\n`;
  });
  
  content += `---\n\n# ${topic.frontMatter.title}\n\n`;
  content += `*This is an outline template for ${topic.filename}*\n\n`;
  
  // Add suggested sections if available
  if (section && section.topicSections) {
    content += `## Suggested Sections\n\n`;
    for (const sectionName of section.topicSections) {
      content += `### ${sectionName}\n\n`;
      content += `*Add content for ${sectionName} here*\n\n`;
    }
  }
  
  return content;
}

async function writeFile(topic, outputDir, content) {
  const filePath = path.join(outputDir, topic.filename);
  await fs.writeFile(filePath, content, 'utf8');
  console.log(`File written: ${filePath}`);
}

// Run the main function
main().catch(err => {
  console.error('Error in documentation generation:', err);
  process.exit(1);
});
// End of generate-docs.js
