/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/qupilot.json`.
 */
export type Qupilot = {
  "address": "2auiCCwYy8pj6LpDnMomZRqKs49Gb5oRjtVkYDYRVmm3",
  "metadata": {
    "name": "qupilot",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "QuPilot reward pool escrow program"
  },
  "instructions": [
    {
      "name": "createQuest",
      "discriminator": [
        112,
        49,
        32,
        224,
        255,
        173,
        5,
        7
      ],
      "accounts": [
        {
          "name": "provider",
          "writable": true,
          "signer": true
        },
        {
          "name": "questPool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  113,
                  117,
                  101,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "provider"
              },
              {
                "kind": "arg",
                "path": "questId"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "questId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "totalRewardPool",
          "type": "u64"
        },
        {
          "name": "rewardPerUser",
          "type": "u64"
        },
        {
          "name": "expiresAt",
          "type": "i64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "questPool",
      "discriminator": [
        239,
        68,
        16,
        31,
        48,
        177,
        249,
        255
      ]
    }
  ],
  "events": [
    {
      "name": "questCreated",
      "discriminator": [
        179,
        90,
        201,
        178,
        90,
        69,
        73,
        67
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidTotalReward",
      "msg": "total_reward_pool must be greater than zero"
    },
    {
      "code": 6001,
      "name": "invalidRewardPerUser",
      "msg": "reward_per_user must be greater than zero"
    },
    {
      "code": 6002,
      "name": "rewardPoolTooSmall",
      "msg": "total_reward_pool must be >= reward_per_user"
    },
    {
      "code": 6003,
      "name": "expiresAtInPast",
      "msg": "expires_at must be in the future"
    }
  ],
  "types": [
    {
      "name": "questCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "questPool",
            "type": "pubkey"
          },
          {
            "name": "provider",
            "type": "pubkey"
          },
          {
            "name": "questId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "totalRewardPool",
            "type": "u64"
          },
          {
            "name": "rewardPerUser",
            "type": "u64"
          },
          {
            "name": "expiresAt",
            "type": "i64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "questPool",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "version",
            "type": "u8"
          },
          {
            "name": "provider",
            "type": "pubkey"
          },
          {
            "name": "questId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "totalRewardPool",
            "type": "u64"
          },
          {
            "name": "rewardPerUser",
            "type": "u64"
          },
          {
            "name": "claimedAmount",
            "type": "u64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "expiresAt",
            "type": "i64"
          },
          {
            "name": "status",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
