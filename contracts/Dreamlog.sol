// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title RitualDreamlog
 * @notice On-chain dream journal powered by Ritual LLM Precompile (0x0802)
 * @dev Users submit dreams → LLM interprets on-chain → results stored immutably → optionally mint NFT
 */
contract RitualDreamlog is ERC721, Ownable {

    // ============================================================
    // CONSTANTS
    // ============================================================

    /// @dev Ritual LLM Precompile address
    address constant LLM_PRECOMPILE = 0x0000000000000000000000000000000000000802;

    /// @dev RitualWallet for fee deposits
    address constant RITUAL_WALLET = 0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948;

    /// @dev LLM model to use
    string constant MODEL = "zai-org/GLM-4.7-FP8";

    /// @dev Default TTL in blocks (~105 seconds at 350ms/block)
    uint256 constant DEFAULT_TTL = 300;

    // ============================================================
    // STATE
    // ============================================================

    struct Dream {
        uint256 id;
        address dreamer;
        string dreamText;
        string interpretation;
        string mood;
        string archetype;
        string emotion;
        string language;
        uint256 timestamp;
        uint256 parentDreamId;  // 0 = standalone
        bool minted;
        bool interpreted;
    }

    uint256 public nextDreamId;
    uint256 public nextTokenId;
    mapping(uint256 => Dream) public dreams;
    mapping(address => uint256[]) public dreamerDreams;

    // ============================================================
    // EVENTS
    // ============================================================

    event DreamSubmitted(uint256 indexed dreamId, address indexed dreamer, string language);
    event DreamInterpreted(uint256 indexed dreamId, string mood, string archetype);
    event DreamChained(uint256 indexed dreamId, uint256 indexed parentDreamId);
    event DreamMinted(uint256 indexed dreamId, uint256 indexed tokenId, address dreamer);
    event DebugLLM(string message);

    // ============================================================
    // ERRORS
    // ============================================================

    error NotYourDream();
    error NotInterpreted();
    error AlreadyMinted();
    error PrecompileFailed();
    error LLMInferenceFailed(string reason);
    error EmptyDreamText();

    // ============================================================
    // CONSTRUCTOR
    // ============================================================

    constructor() ERC721("Ritual Dreamlog", "DREAM") Ownable(msg.sender) {}

    // ============================================================
    // EXTERNAL FUNCTIONS
    // ============================================================

    /**
     * @notice Submit a dream and trigger on-chain LLM interpretation
     * @param dreamText The dream text (any language)
     * @param language ISO language code (e.g., "id", "jp", "en")
     * @return dreamId The unique dream ID
     * @dev This is a short-running async call — ONE per transaction
     */
    function submitAndInterpret(
        string calldata dreamText,
        string calldata language
    ) external returns (uint256 dreamId) {
        if (bytes(dreamText).length == 0) revert EmptyDreamText();

        dreamId = nextDreamId++;

        // Store basic dream data
        Dream storage dream = dreams[dreamId];
        dream.id = dreamId;
        dream.dreamer = msg.sender;
        dream.dreamText = dreamText;
        dream.language = language;
        dream.timestamp = block.timestamp;
        dream.interpreted = false;
        dream.minted = false;

        dreamerDreams[msg.sender].push(dreamId);

        emit DreamSubmitted(dreamId, msg.sender, language);

        // Build messages JSON — simple format, no response_format
        string memory messagesJson = _buildMessages(dreamText);

        // Call LLM Precompile — EXACT 30-field format from Ritual skill
        // Using empty bytes for responseFormatData (no structured output)
        bytes memory input = abi.encode(
            address(0),             // 1. executor (address(0) = let chain pick)
            new bytes[](0),         // 2. encryptedSecrets
            uint256(DEFAULT_TTL),   // 3. ttl
            new bytes[](0),         // 4. secretSignatures
            bytes(""),              // 5. userPublicKey
            messagesJson,           // 6. messagesJson
            MODEL,                  // 7. model
            int256(0),              // 8. frequencyPenalty
            "",                     // 9. logitBiasJson
            false,                  // 10. logprobs
            int256(4096),           // 11. maxCompletionTokens (>=4096 for GLM-4.7-FP8)
            "",                     // 12. metadataJson
            "",                     // 13. modalitiesJson
            uint256(1),             // 14. n
            true,                   // 15. parallelToolCalls
            int256(0),              // 16. presencePenalty
            "medium",               // 17. reasoningEffort
            bytes(""),              // 18. responseFormatData (EMPTY — no structured output)
            int256(-1),             // 19. seed (null)
            "auto",                 // 20. serviceTier
            "",                     // 21. stopJson
            false,                  // 22. stream
            int256(700),            // 23. temperature (0.7)
            bytes(""),              // 24. toolChoiceData
            bytes(""),              // 25. toolsData
            int256(-1),             // 26. topLogprobs (null)
            int256(1000),           // 27. topP (1.0)
            "",                     // 28. user
            false,                  // 29. piiEnabled
            abi.encode("", "", "")  // 30. convoHistory (empty StorageRef — no history)
        );

        emit DebugLLM("Calling LLM precompile...");

        (bool success, bytes memory result) = LLM_PRECOMPILE.call(input);
        if (!success) revert PrecompileFailed();

        // Unwrap async envelope: (bytes simmedInput, bytes actualOutput)
        (, bytes memory actualOutput) = abi.decode(result, (bytes, bytes));

        // Decode LLM response — first 4 fields (skip updatedConvoHistory tuple at end)
        (
            bool hasError,
            bytes memory completionData,
            ,
            string memory errorMessage
        ) = abi.decode(actualOutput, (bool, bytes, bytes, string));

        if (hasError) revert LLMInferenceFailed(errorMessage);

        // Parse the completion data to extract the interpretation
        _parseAndStoreInterpretation(dreamId, completionData);

        emit DreamInterpreted(dreamId, dream.mood, dream.archetype);
    }

    /**
     * @notice Chain a dream to a parent dream (storyline)
     */
    function chainDream(uint256 dreamId, uint256 parentDreamId) external {
        Dream storage dream = dreams[dreamId];
        Dream storage parent = dreams[parentDreamId];

        if (dream.dreamer != msg.sender) revert NotYourDream();
        if (parent.dreamer != msg.sender) revert NotYourDream();

        dream.parentDreamId = parentDreamId == 0 ? dreamId : parentDreamId;

        emit DreamChained(dreamId, parentDreamId);
    }

    /**
     * @notice Mint a dream card as an NFT
     */
    function mintDreamCard(uint256 dreamId) external returns (uint256 tokenId) {
        Dream storage dream = dreams[dreamId];

        if (dream.dreamer != msg.sender) revert NotYourDream();
        if (!dream.interpreted) revert NotInterpreted();
        if (dream.minted) revert AlreadyMinted();

        tokenId = nextTokenId++;
        dream.minted = true;

        _safeMint(msg.sender, tokenId);

        emit DreamMinted(dreamId, tokenId, msg.sender);
    }

    // ============================================================
    // VIEW FUNCTIONS
    // ============================================================

    function getDream(uint256 dreamId) external view returns (Dream memory) {
        return dreams[dreamId];
    }

    function getDreamsByAddress(address dreamer) external view returns (uint256[] memory) {
        return dreamerDreams[dreamer];
    }

    function getTotalDreams() external view returns (uint256) {
        return nextDreamId;
    }

    function tokenURI(uint256 tokenId) public pure override returns (string memory) {
        return string(abi.encodePacked("ipfs://dreamlog/", _uint2str(tokenId)));
    }

    function _uint2str(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    // ============================================================
    // INTERNAL FUNCTIONS
    // ============================================================

    /**
     * @dev Build OpenAI-style messages JSON
     * @dev System prompt instructs LLM to return JSON with mood/archetype/emotion/interpretation
     */
    function _buildMessages(
        string memory dreamText
    ) internal pure returns (string memory) {
        string memory systemPrompt = "You are a dream interpreter. Analyze the dream and reply with ONLY a JSON object: {\"symbols\":[\"sym1\",\"sym2\"],\"emotion\":\"primary emotion\",\"archetype\":\"Jungian archetype\",\"interpretation\":\"2-3 sentence interpretation\",\"mood\":\"one of: mystical, dark, zen, wonder, horror, confused\"}. No markdown, no extra text, just the JSON object.";

        return string(
            abi.encodePacked(
                '[{"role":"system","content":"', _escapeJson(systemPrompt), '"},',
                '{"role":"user","content":"', _escapeJson(dreamText), '"}]'
            )
        );
    }

    /**
     * @dev Parse LLM completion data and store interpretation
     * @dev completionData is ABI-encoded CompletionData
     */
    function _parseAndStoreInterpretation(
        uint256 dreamId,
        bytes memory completionData
    ) internal {
        Dream storage dream = dreams[dreamId];

        // Decode CompletionData structure:
        // (string id, string object, uint256 created, string model,
        //  string systemFingerprint, string serviceTier,
        //  uint256 choicesCount, bytes[] choicesData, bytes usageData)
        (, , , , , , uint256 choicesCount, bytes[] memory choicesData, ) =
            abi.decode(completionData, (string, string, uint256, string, string, string, uint256, bytes[], bytes));

        if (choicesCount == 0 || choicesData.length == 0) {
            // Fallback if no choices
            dream.interpreted = true;
            dream.interpretation = "No interpretation available";
            dream.mood = "mystical";
            dream.archetype = "The Dreamer";
            dream.emotion = "Unknown";
            return;
        }

        // Decode first choice: (uint256 index, string finishReason, bytes messageData)
        (, , bytes memory messageData) =
            abi.decode(choicesData[0], (uint256, string, bytes));

        // Decode message: (string role, string content, string refusal, uint256 toolCallsCount, bytes[] toolCallsData)
        (, string memory content, , , ) =
            abi.decode(messageData, (string, string, string, uint256, bytes[]));

        // Store the raw interpretation
        dream.interpretation = content;
        dream.interpreted = true;

        // Extract fields from JSON content (best-effort string matching)
        if (_contains(content, '"mood":"mystical"')) dream.mood = "mystical";
        else if (_contains(content, '"mood":"dark"')) dream.mood = "dark";
        else if (_contains(content, '"mood":"zen"')) dream.mood = "zen";
        else if (_contains(content, '"mood":"wonder"')) dream.mood = "wonder";
        else if (_contains(content, '"mood":"horror"')) dream.mood = "horror";
        else if (_contains(content, '"mood":"confused"')) dream.mood = "confused";
        else dream.mood = "mystical"; // default

        if (_contains(content, '"archetype":')) {
            dream.archetype = _extractJsonString(content, "archetype");
        } else {
            dream.archetype = "The Dreamer";
        }

        if (_contains(content, '"emotion":')) {
            dream.emotion = _extractJsonString(content, "emotion");
        } else {
            dream.emotion = "Unknown";
        }
    }

    function _contains(string memory haystack, string memory needle) internal pure returns (bool) {
        return bytes(haystack).length > 0 && bytes(needle).length > 0 &&
               _indexOf(haystack, needle) != -1;
    }

    function _indexOf(string memory haystack, string memory needle) internal pure returns (int256) {
        bytes memory h = bytes(haystack);
        bytes memory n = bytes(needle);
        if (n.length > h.length) return -1;
        if (n.length == 0) return 0;

        for (uint256 i = 0; i <= h.length - n.length; i++) {
            bool found = true;
            for (uint256 j = 0; j < n.length; j++) {
                if (h[i + j] != n[j]) {
                    found = false;
                    break;
                }
            }
            if (found) return int256(i);
        }
        return -1;
    }

    function _extractJsonString(string memory json, string memory key) internal pure returns (string memory) {
        bytes memory jb = bytes(json);
        bytes memory search = bytes(abi.encodePacked('"', key, '":"'));

        int256 startIdx = _indexOf(json, string(search));
        if (startIdx == -1) return "Unknown";

        uint256 start = uint256(startIdx) + search.length;
        uint256 end = start;

        for (uint256 i = start; i < jb.length; i++) {
            if (jb[i] == '"') {
                if (i == 0 || jb[i - 1] != '\\') {
                    end = i;
                    break;
                }
            }
        }

        if (end <= start) return "Unknown";

        bytes memory result = new bytes(end - start);
        for (uint256 i = start; i < end; i++) {
            result[i - start] = jb[i];
        }
        return string(result);
    }

    function _escapeJson(string memory s) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        bytes memory result = new bytes(b.length * 2);
        uint256 j = 0;

        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] == '"') {
                result[j++] = '\\';
                result[j++] = '"';
            } else if (b[i] == '\\') {
                result[j++] = '\\';
                result[j++] = '\\';
            } else if (b[i] == '\n') {
                result[j++] = '\\';
                result[j++] = 'n';
            } else if (b[i] == '\r') {
                result[j++] = '\\';
                result[j++] = 'r';
            } else if (b[i] == '\t') {
                result[j++] = '\\';
                result[j++] = 't';
            } else {
                result[j++] = b[i];
            }
        }

        bytes memory trimmed = new bytes(j);
        for (uint256 i = 0; i < j; i++) {
            trimmed[i] = result[i];
        }
        return string(trimmed);
    }

    function withdrawFees() external onlyOwner {
        (bool success, ) = RITUAL_WALLET.call(
            abi.encodeWithSignature("withdraw(uint256)", type(uint256).max)
        );
        require(success, "Withdraw failed");
    }

    function depositForFees() external payable {
        (bool success, ) = RITUAL_WALLET.call{value: msg.value}(
            abi.encodeWithSignature("deposit(uint256)", 5000)
        );
        require(success, "Deposit failed");
    }

    receive() external payable {}
}
