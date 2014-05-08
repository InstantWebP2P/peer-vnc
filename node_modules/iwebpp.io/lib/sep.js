// iWebPP Session Establish Protocol Definition
// Copyright (c) 2012 Tom Zhou<iwebpp@gmail.com>
//

// Version 1.0
exports.version = exports.VERSION = '1.0';

// the process between name-server and name-client is below:
// 1. started name-server, relay-server
// 2. waiting for name-client connect to name-server
// 3. calculating and analyzing name-server to name-client traceroute
// 4. name-server responds to name-client's P2P or C/S connection requirement
// 5. name-client start keep-alive timer to maintain self's public ip/port - TBD...

// SEP offer/answer opcode:
//   0/1: client<->server for SDP session setup offer/answer
//   2/3: client<->server for NAT type report offer/answer
//   4/5: client<->server for STUN session setup offer/answer
//   6/7: server<->client for UDP hole punch setup offer/answer
//   8/9: client<->server for TURN session setup offer/answer
// 10/11: client<->server for KGEN session setup offer/answer
exports.sep_opc_sdp_offer    = exports.SEP_OPC_SDP_OFFER    = 0;
exports.sep_opc_sdp_answer   = exports.SEP_OPC_SDP_ANSWER   = 1;
exports.sep_opc_nat_offer    = exports.SEP_OPC_NAT_OFFER    = 2;
exports.sep_opc_nat_answer   = exports.SEP_OPC_NAT_ANSWER   = 3;
exports.sep_opc_stun_offer   = exports.SEP_OPC_STUN_OFFER   = 4;
exports.sep_opc_stun_answer  = exports.SEP_OPC_STUN_ANSWER  = 5;
exports.sep_opc_punch_offer  = exports.SEP_OPC_PUNCH_OFFER  = 6;
exports.sep_opc_punch_answer = exports.SEP_OPC_PUNCH_ANSWER = 7;
exports.sep_opc_turn_offer   = exports.SEP_OPC_TURN_OFFER   = 8;
exports.sep_opc_turn_answer  = exports.SEP_OPC_TURN_ANSWER  = 9;
exports.sep_opc_kgen_offer   = exports.SEP_OPC_KGEN_OFFER   = 10;
exports.sep_opc_kgen_answer  = exports.SEP_OPC_KGEN_ANSWER  = 11;

// SEP user's device and login info opcode:
exports.sep_opc_all_login_offer  = exports.SEP_OPC_ALL_LOGIN_OFFER  = 12;
exports.sep_opc_all_login_answer = exports.SEP_OPC_ALL_LOGIN_ANSWER = 13;
exports.sep_opc_usr_login_offer  = exports.SEP_OPC_USR_LOGIN_OFFER  = 14;
exports.sep_opc_usr_login_answer = exports.SEP_OPC_USR_LOGIN_ANSWER = 15;

exports.sep_opc_all_usr_offer    = exports.SEP_OPC_ALL_USR_OFFER    = 16;
exports.sep_opc_all_usr_answer   = exports.SEP_OPC_ALL_USR_ANSWER   = 17;

exports.sep_opc_all_sdp_offer    = exports.SEP_OPC_ALL_SDP_OFFER    = 18;
exports.sep_opc_all_sdp_answer   = exports.SEP_OPC_ALL_SDP_ANSWER   = 19;
exports.sep_opc_clnt_sdp_offer   = exports.SEP_OPC_CLNT_SDP_OFFER   = 20;
exports.sep_opc_clnt_sdp_answer  = exports.SEP_OPC_CLNT_SDP_ANSWER  = 21;

// Peer service opcode:
exports.sep_opc_srv_report_offer  = exports.SEP_OPC_SRV_REPORT_OFFER  = 22;
exports.sep_opc_srv_report_answer = exports.SEP_OPC_SRV_REPORT_ANSWER = 23;
exports.sep_opc_srv_update_offer  = exports.SEP_OPC_SRV_UPDATE_OFFER  = 24;
exports.sep_opc_srv_update_answer = exports.SEP_OPC_SRV_UPDATE_ANSWER = 25;

// vURL info opcode:
exports.sep_opc_vurl_info_offer  = exports.SEP_OPC_VURL_INFO_OFFER  = 26;
exports.sep_opc_vurl_info_answer = exports.SEP_OPC_VURL_INFO_ANSWER = 27;

// Peer service query opcode:
exports.sep_opc_srv_query_offer  = exports.SEP_OPC_SRV_QUERY_OFFER  = 28;
exports.sep_opc_srv_query_answer = exports.SEP_OPC_SRV_QUERY_ANSWER = 29;

// SEP answer state
exports.sep_opc_state_ready = exports.SEP_OPC_STATE_READY = 0;
exports.sep_opc_state_fail  = exports.SEP_OPC_STATE_FAIL  = 1;

// Peer connection mode: c/s vs p2p
exports.sep_mode_cs = exports.SEP_MODE_CS = 0;
exports.sep_mode_pp = exports.SEP_MODE_PP = 1;

// Peer session mode: TURN or STUN
exports.sep_sesn_stun = exports.SEP_SESN_STUN = 0;
exports.sep_sesn_turn = exports.SEP_SESN_TURN = 1;

// Peer secure mode, level-based
// supported secure mode:
//   - 0: disable https/wss(SSL)
//   - 1: enable https/wss(SSL)
//   - 2: enable https/wss(SSL),
//        allow turn-agent connection,
//        allow host-only-based-token authentication with stun session
//   - 3: enable https/wss,
//        allow turn-agent connection,
//        allow host-port-based-token authentication with stun session
exports.sep_sec_none              = exports.SEP_SEC_NONE              = 0;
exports.sep_sec_ssl               = exports.SEP_SEC_SSL               = 1;
exports.sep_sec_ssl_acl_host      = exports.SEP_SEC_SSL_ACL_HOST      = 2;
exports.sep_sec_ssl_acl_host_port = exports.SEP_SEC_SSL_ACL_HOST_PORT = 3;

// Server URL control path prefix
exports.sep_ctrlpath_ns = exports.SEP_CTRLPATH_NS = '/ctrlpathns'; // name server, reserved
exports.sep_ctrlpath_as = exports.SEP_CTRLPATH_AS = '/ctrlpathas'; // agent server, reserved
exports.sep_ctrlpath_ps = exports.SEP_CTRLPATH_PS = '/ctrlpathps'; // proxy server, reserved
exports.sep_ctrlpath_hs = exports.SEP_CTRLPATH_HS = '/ctrlpathhs'; // hole punch server, reserved
exports.sep_ctrlpath_bs = exports.SEP_CTRLPATH_BS =           '/'; // business server, default path '/'

