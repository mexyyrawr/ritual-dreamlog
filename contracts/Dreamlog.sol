// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PrecompileConsumer} from "./utils/PrecompileConsumer.sol";

/// @title Ritual Dreamlog
/// @notice On-chain dream journal with LLM-powered interpretation via Ritual precompile
contract Dreamlog is PrecompileConsumer {
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
        uint256 parentDreamId;
        bool minted;
        bool interpreted;
    }

    uint256 public nextDreamId;
    mapping(uint256 => Dream) public dreams;
    mapping(address => uint256[]) public dreamerDreams;

    event DreamSubmitted(uint256 indexed dreamId, address indexed dreamer, string language);
    event DreamInterpreted(uint256 indexed dreamId, string mood, string archetype);

    /// @notice Submit a dream to the journal
    /// @param dreamText The dream description
    /// @param language The language code (id, en, ja, etc.)
    /// @return dreamId The assigned dream ID
    function submitDream(string calldata dreamText, string calldata language) external returns (uint256 dreamId) {
        dreamId = nextDreamId++;
        dreams[dreamId] = Dream({
            id: dreamId,
            dreamer: msg.sender,
            dreamText: dreamText,
            interpretation: "",
            mood: "",
            archetype: "",
            emotion: "",
            language: language,
            timestamp: block.timestamp,
            parentDreamId: 0,
            minted: false,
            interpreted: false
        });
        dreamerDreams[msg.sender].push(dreamId);
        emit DreamSubmitted(dreamId, msg.sender, language);
    }

    /// @notice Call the LLM precompile to interpret a dream
    /// @param dreamId The dream to interpret
    /// @param llmInput The pre-encoded LLM request (25-field ABI from frontend)
    function interpretDream(uint256 dreamId, bytes calldata llmInput) external {
        require(dreams[dreamId].dreamer == msg.sender, "not your dream");
        require(!dreams[dreamId].interpreted, "already interpreted");

        bytes memory output = _executePrecompile(LLM_INFERENCE_PRECOMPILE, llmInput);

        // Decode: (bool hasError, bytes completionData, bytes modelMetadata, string errorMessage, (string,string,string) convoHistory)
        (
            bool hasError,
            bytes memory completionData,
            ,
            string memory errorMessage,
        ) = abi.decode(output, (bool, bytes, bytes, string, string[3]));

        require(!hasError, errorMessage);

        // Parse completionData as JSON string
        string memory interpretation = _bytesToString(completionData);
        dreams[dreamId].interpretation = interpretation;
        dreams[dreamId].interpreted = true;

        // Emit with default mood (frontend will parse actual mood from JSON)
        emit DreamInterpreted(dreamId, "mystical", "unknown");
    }

    /// @notice Store interpretation result (called by frontend after parsing)
    /// @param dreamId The dream ID
    /// @param interpretation The interpretation text
    function storeResult(uint256 dreamId, string calldata interpretation) external {
        require(dreams[dreamId].dreamer == msg.sender, "not your dream");
        dreams[dreamId].interpretation = interpretation;
        dreams[dreamId].interpreted = true;
    }

    /// @notice Get a dream by ID
    function getDream(uint256 dreamId) external view returns (Dream memory) {
        return dreams[dreamId];
    }

    /// @notice Get all dream IDs for an address
    function getDreamsByAddress(address dreamer) external view returns (uint256[] memory) {
        return dreamerDreams[dreamer];
    }

    /// @notice Get total number of dreams
    function getTotalDreams() external view returns (uint256) {
        return nextDreamId;
    }

    /// @dev Convert bytes to string
    function _bytesToString(bytes memory data) internal pure returns (string memory) {
        bytes memory result = new bytes(data.length);
        for (uint256 i = 0; i < data.length; i++) {
            result[i] = data[i];
        }
        return string(result);
    }
}
