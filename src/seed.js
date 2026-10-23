// Danh mục và khung ma trận từ repo gốc, commit 1c85b67. Không phải dữ liệu Firebase trực tiếp.
const RAW_SEED = {
  "schemaVersion": 1,
  "school": {
    "name": "Trường THCS & THPT",
    "year": "Năm học 2026-2027",
    "term": "HK1",
    "appliedDate": ""
  },
  "classes": [
    {
      "id": "cls_6a1",
      "code": "6A1",
      "name": "Lớp 6A1",
      "grade": 6,
      "homeroomTeacherId": "",
      "coHomeroomTeacherId": ""
    },
    {
      "id": "cls_6a2",
      "code": "6A2",
      "name": "Lớp 6A2",
      "grade": 6,
      "homeroomTeacherId": "",
      "coHomeroomTeacherId": ""
    },
    {
      "id": "cls_6a3",
      "code": "6A3",
      "name": "Lớp 6A3",
      "grade": 6,
      "homeroomTeacherId": "",
      "coHomeroomTeacherId": ""
    },
    {
      "id": "cls_7a1",
      "code": "7A1",
      "name": "Lớp 7A1",
      "grade": 7,
      "homeroomTeacherId": "",
      "coHomeroomTeacherId": ""
    },
    {
      "id": "cls_7a2",
      "code": "7A2",
      "name": "Lớp 7A2",
      "grade": 7,
      "homeroomTeacherId": "",
      "coHomeroomTeacherId": ""
    },
    {
      "id": "cls_7a3",
      "code": "7A3",
      "name": "Lớp 7A3",
      "grade": 7,
      "homeroomTeacherId": "",
      "coHomeroomTeacherId": ""
    },
    {
      "id": "cls_8a1",
      "code": "8A1",
      "name": "Lớp 8A1",
      "grade": 8,
      "homeroomTeacherId": "",
      "coHomeroomTeacherId": ""
    },
    {
      "id": "cls_8a2",
      "code": "8A2",
      "name": "Lớp 8A2",
      "grade": 8,
      "homeroomTeacherId": "",
      "coHomeroomTeacherId": ""
    },
    {
      "id": "cls_8a3",
      "code": "8A3",
      "name": "Lớp 8A3",
      "grade": 8,
      "homeroomTeacherId": "",
      "coHomeroomTeacherId": ""
    },
    {
      "id": "cls_9a1",
      "code": "9A1",
      "name": "Lớp 9A1",
      "grade": 9,
      "homeroomTeacherId": "",
      "coHomeroomTeacherId": ""
    },
    {
      "id": "cls_9a2",
      "code": "9A2",
      "name": "Lớp 9A2",
      "grade": 9,
      "homeroomTeacherId": "",
      "coHomeroomTeacherId": ""
    },
    {
      "id": "cls_9a3",
      "code": "9A3",
      "name": "Lớp 9A3",
      "grade": 9,
      "homeroomTeacherId": "",
      "coHomeroomTeacherId": ""
    },
    {
      "id": "cls_10tn",
      "code": "10TN",
      "name": "Lớp 10TN",
      "grade": 10,
      "homeroomTeacherId": "",
      "coHomeroomTeacherId": ""
    },
    {
      "id": "cls_10xh",
      "code": "10XH",
      "name": "Lớp 10XH",
      "grade": 10,
      "homeroomTeacherId": "",
      "coHomeroomTeacherId": ""
    },
    {
      "id": "cls_11",
      "code": "11",
      "name": "Lớp 11",
      "grade": 11,
      "homeroomTeacherId": "",
      "coHomeroomTeacherId": ""
    },
    {
      "id": "cls_12tn",
      "code": "12TN",
      "name": "Lớp 12TN",
      "grade": 12,
      "homeroomTeacherId": "",
      "coHomeroomTeacherId": ""
    },
    {
      "id": "cls_12xh",
      "code": "12XH",
      "name": "Lớp 12XH",
      "grade": 12,
      "homeroomTeacherId": "",
      "coHomeroomTeacherId": ""
    }
  ],
  "subjects": [
    {
      "id": "subj_toan",
      "code": "TOAN",
      "name": "Toán",
      "color": "#2563eb"
    },
    {
      "id": "subj_phy",
      "code": "VAT_LI",
      "name": "Vật lí",
      "color": "#0284c7"
    },
    {
      "id": "subj_khtn_li",
      "code": "KHTN_LI",
      "name": "KHTN - Lí",
      "color": "#0ea5e9"
    },
    {
      "id": "subj_che",
      "code": "HOA_HOC",
      "name": "Hóa học",
      "color": "#0d9488"
    },
    {
      "id": "subj_knht_hoa",
      "code": "KNHT_HOA",
      "name": "KNHT-Hóa",
      "color": "#14b8a6"
    },
    {
      "id": "subj_bio",
      "code": "SINH_HOC",
      "name": "Sinh học",
      "color": "#16a34a"
    },
    {
      "id": "subj_khtn_sinh",
      "code": "KHTN_SINH",
      "name": "KHTN-sinh",
      "color": "#22c55e"
    },
    {
      "id": "subj_van",
      "code": "VAN",
      "name": "Ngữ văn",
      "color": "#e11d48"
    },
    {
      "id": "subj_pe",
      "code": "THE_DUC",
      "name": "Thể dục",
      "color": "#ea580c"
    },
    {
      "id": "subj_eng",
      "code": "TIENG_ANH",
      "name": "Tiếng anh",
      "color": "#9333ea"
    },
    {
      "id": "subj_tin",
      "code": "TIN_HOC",
      "name": "Tin học",
      "color": "#0891b2"
    },
    {
      "id": "subj_stem",
      "code": "AI_ROBOTICS",
      "name": "AI-robotics",
      "color": "#f59e0b"
    },
    {
      "id": "subj_giao_duc_ai",
      "code": "GD_AI",
      "name": "Giáo dục AI",
      "color": "#d97706"
    },
    {
      "id": "subj_ls_dia",
      "code": "LS_DL",
      "name": "LS-ĐL",
      "color": "#ca8a04"
    },
    {
      "id": "subj_dia_thpt",
      "code": "DIA_LI",
      "name": "Địa lí",
      "color": "#b45309"
    },
    {
      "id": "subj_ls_thpt",
      "code": "LICH_SU",
      "name": "Lịch sử",
      "color": "#c2410c"
    },
    {
      "id": "subj_am_nhac",
      "code": "AM_NHAC",
      "name": "Âm nhạc",
      "color": "#ec4899"
    },
    {
      "id": "subj_my_thuat",
      "code": "MY_THUAT",
      "name": "Mỹ thuật",
      "color": "#db2777"
    },
    {
      "id": "subj_gddp",
      "code": "GDDP",
      "name": "GDĐP",
      "color": "#7c3aed"
    },
    {
      "id": "subj_ta_esl",
      "code": "TA_ESL",
      "name": "TA ESL",
      "color": "#6366f1"
    },
    {
      "id": "subj_clb",
      "code": "CLB",
      "name": "CLB",
      "color": "#059669"
    },
    {
      "id": "subj_hdtn_hn",
      "code": "HDTN_HN",
      "name": "HĐTN - HN",
      "color": "#4f46e5"
    },
    {
      "id": "subj_special_chao_co",
      "code": "CHAO_CO",
      "name": "Chào cờ",
      "color": "#dc2626"
    }
  ],
  "teachers": [],
  "timeSlots": [
    {
      "id": "ts_d2_m_1",
      "dayOfWeek": 2,
      "dayName": "Thứ 2",
      "session": "MORNING",
      "period": 1,
      "globalPeriod": 1,
      "startTime": "07:45",
      "endTime": "08:30"
    },
    {
      "id": "ts_d2_m_2",
      "dayOfWeek": 2,
      "dayName": "Thứ 2",
      "session": "MORNING",
      "period": 2,
      "globalPeriod": 2,
      "startTime": "08:30",
      "endTime": "09:15"
    },
    {
      "id": "ts_d2_m_3",
      "dayOfWeek": 2,
      "dayName": "Thứ 2",
      "session": "MORNING",
      "period": 3,
      "globalPeriod": 3,
      "startTime": "09:15",
      "endTime": "10:00"
    },
    {
      "id": "ts_d2_m_4",
      "dayOfWeek": 2,
      "dayName": "Thứ 2",
      "session": "MORNING",
      "period": 4,
      "globalPeriod": 4,
      "startTime": "10:20",
      "endTime": "11:05"
    },
    {
      "id": "ts_d2_m_5",
      "dayOfWeek": 2,
      "dayName": "Thứ 2",
      "session": "MORNING",
      "period": 5,
      "globalPeriod": 5,
      "startTime": "11:05",
      "endTime": "11:50"
    },
    {
      "id": "ts_d2_a_1",
      "dayOfWeek": 2,
      "dayName": "Thứ 2",
      "session": "AFTERNOON",
      "period": 1,
      "globalPeriod": 6,
      "startTime": "13:30",
      "endTime": "14:10"
    },
    {
      "id": "ts_d2_a_2",
      "dayOfWeek": 2,
      "dayName": "Thứ 2",
      "session": "AFTERNOON",
      "period": 2,
      "globalPeriod": 7,
      "startTime": "14:10",
      "endTime": "14:50"
    },
    {
      "id": "ts_d2_a_3",
      "dayOfWeek": 2,
      "dayName": "Thứ 2",
      "session": "AFTERNOON",
      "period": 3,
      "globalPeriod": 8,
      "startTime": "15:10",
      "endTime": "15:50"
    },
    {
      "id": "ts_d2_a_4",
      "dayOfWeek": 2,
      "dayName": "Thứ 2",
      "session": "AFTERNOON",
      "period": 4,
      "globalPeriod": 9,
      "startTime": "15:50",
      "endTime": "16:30"
    },
    {
      "id": "ts_d3_m_1",
      "dayOfWeek": 3,
      "dayName": "Thứ 3",
      "session": "MORNING",
      "period": 1,
      "globalPeriod": 1,
      "startTime": "07:45",
      "endTime": "08:30"
    },
    {
      "id": "ts_d3_m_2",
      "dayOfWeek": 3,
      "dayName": "Thứ 3",
      "session": "MORNING",
      "period": 2,
      "globalPeriod": 2,
      "startTime": "08:30",
      "endTime": "09:15"
    },
    {
      "id": "ts_d3_m_3",
      "dayOfWeek": 3,
      "dayName": "Thứ 3",
      "session": "MORNING",
      "period": 3,
      "globalPeriod": 3,
      "startTime": "09:15",
      "endTime": "10:00"
    },
    {
      "id": "ts_d3_m_4",
      "dayOfWeek": 3,
      "dayName": "Thứ 3",
      "session": "MORNING",
      "period": 4,
      "globalPeriod": 4,
      "startTime": "10:20",
      "endTime": "11:05"
    },
    {
      "id": "ts_d3_m_5",
      "dayOfWeek": 3,
      "dayName": "Thứ 3",
      "session": "MORNING",
      "period": 5,
      "globalPeriod": 5,
      "startTime": "11:05",
      "endTime": "11:50"
    },
    {
      "id": "ts_d3_a_1",
      "dayOfWeek": 3,
      "dayName": "Thứ 3",
      "session": "AFTERNOON",
      "period": 1,
      "globalPeriod": 6,
      "startTime": "13:30",
      "endTime": "14:10"
    },
    {
      "id": "ts_d3_a_2",
      "dayOfWeek": 3,
      "dayName": "Thứ 3",
      "session": "AFTERNOON",
      "period": 2,
      "globalPeriod": 7,
      "startTime": "14:10",
      "endTime": "14:50"
    },
    {
      "id": "ts_d3_a_3",
      "dayOfWeek": 3,
      "dayName": "Thứ 3",
      "session": "AFTERNOON",
      "period": 3,
      "globalPeriod": 8,
      "startTime": "15:10",
      "endTime": "15:50"
    },
    {
      "id": "ts_d3_a_4",
      "dayOfWeek": 3,
      "dayName": "Thứ 3",
      "session": "AFTERNOON",
      "period": 4,
      "globalPeriod": 9,
      "startTime": "15:50",
      "endTime": "16:30"
    },
    {
      "id": "ts_d4_m_1",
      "dayOfWeek": 4,
      "dayName": "Thứ 4",
      "session": "MORNING",
      "period": 1,
      "globalPeriod": 1,
      "startTime": "07:45",
      "endTime": "08:30"
    },
    {
      "id": "ts_d4_m_2",
      "dayOfWeek": 4,
      "dayName": "Thứ 4",
      "session": "MORNING",
      "period": 2,
      "globalPeriod": 2,
      "startTime": "08:30",
      "endTime": "09:15"
    },
    {
      "id": "ts_d4_m_3",
      "dayOfWeek": 4,
      "dayName": "Thứ 4",
      "session": "MORNING",
      "period": 3,
      "globalPeriod": 3,
      "startTime": "09:15",
      "endTime": "10:00"
    },
    {
      "id": "ts_d4_m_4",
      "dayOfWeek": 4,
      "dayName": "Thứ 4",
      "session": "MORNING",
      "period": 4,
      "globalPeriod": 4,
      "startTime": "10:20",
      "endTime": "11:05"
    },
    {
      "id": "ts_d4_m_5",
      "dayOfWeek": 4,
      "dayName": "Thứ 4",
      "session": "MORNING",
      "period": 5,
      "globalPeriod": 5,
      "startTime": "11:05",
      "endTime": "11:50"
    },
    {
      "id": "ts_d4_a_1",
      "dayOfWeek": 4,
      "dayName": "Thứ 4",
      "session": "AFTERNOON",
      "period": 1,
      "globalPeriod": 6,
      "startTime": "13:30",
      "endTime": "14:10"
    },
    {
      "id": "ts_d4_a_2",
      "dayOfWeek": 4,
      "dayName": "Thứ 4",
      "session": "AFTERNOON",
      "period": 2,
      "globalPeriod": 7,
      "startTime": "14:10",
      "endTime": "14:50"
    },
    {
      "id": "ts_d4_a_3",
      "dayOfWeek": 4,
      "dayName": "Thứ 4",
      "session": "AFTERNOON",
      "period": 3,
      "globalPeriod": 8,
      "startTime": "15:10",
      "endTime": "15:50"
    },
    {
      "id": "ts_d4_a_4",
      "dayOfWeek": 4,
      "dayName": "Thứ 4",
      "session": "AFTERNOON",
      "period": 4,
      "globalPeriod": 9,
      "startTime": "15:50",
      "endTime": "16:30"
    },
    {
      "id": "ts_d5_m_1",
      "dayOfWeek": 5,
      "dayName": "Thứ 5",
      "session": "MORNING",
      "period": 1,
      "globalPeriod": 1,
      "startTime": "07:45",
      "endTime": "08:30"
    },
    {
      "id": "ts_d5_m_2",
      "dayOfWeek": 5,
      "dayName": "Thứ 5",
      "session": "MORNING",
      "period": 2,
      "globalPeriod": 2,
      "startTime": "08:30",
      "endTime": "09:15"
    },
    {
      "id": "ts_d5_m_3",
      "dayOfWeek": 5,
      "dayName": "Thứ 5",
      "session": "MORNING",
      "period": 3,
      "globalPeriod": 3,
      "startTime": "09:15",
      "endTime": "10:00"
    },
    {
      "id": "ts_d5_m_4",
      "dayOfWeek": 5,
      "dayName": "Thứ 5",
      "session": "MORNING",
      "period": 4,
      "globalPeriod": 4,
      "startTime": "10:20",
      "endTime": "11:05"
    },
    {
      "id": "ts_d5_m_5",
      "dayOfWeek": 5,
      "dayName": "Thứ 5",
      "session": "MORNING",
      "period": 5,
      "globalPeriod": 5,
      "startTime": "11:05",
      "endTime": "11:50"
    },
    {
      "id": "ts_d5_a_1",
      "dayOfWeek": 5,
      "dayName": "Thứ 5",
      "session": "AFTERNOON",
      "period": 1,
      "globalPeriod": 6,
      "startTime": "13:30",
      "endTime": "14:10"
    },
    {
      "id": "ts_d5_a_2",
      "dayOfWeek": 5,
      "dayName": "Thứ 5",
      "session": "AFTERNOON",
      "period": 2,
      "globalPeriod": 7,
      "startTime": "14:10",
      "endTime": "14:50"
    },
    {
      "id": "ts_d5_a_3",
      "dayOfWeek": 5,
      "dayName": "Thứ 5",
      "session": "AFTERNOON",
      "period": 3,
      "globalPeriod": 8,
      "startTime": "15:10",
      "endTime": "15:50"
    },
    {
      "id": "ts_d5_a_4",
      "dayOfWeek": 5,
      "dayName": "Thứ 5",
      "session": "AFTERNOON",
      "period": 4,
      "globalPeriod": 9,
      "startTime": "15:50",
      "endTime": "16:30"
    },
    {
      "id": "ts_d6_m_1",
      "dayOfWeek": 6,
      "dayName": "Thứ 6",
      "session": "MORNING",
      "period": 1,
      "globalPeriod": 1,
      "startTime": "07:45",
      "endTime": "08:30"
    },
    {
      "id": "ts_d6_m_2",
      "dayOfWeek": 6,
      "dayName": "Thứ 6",
      "session": "MORNING",
      "period": 2,
      "globalPeriod": 2,
      "startTime": "08:30",
      "endTime": "09:15"
    },
    {
      "id": "ts_d6_m_3",
      "dayOfWeek": 6,
      "dayName": "Thứ 6",
      "session": "MORNING",
      "period": 3,
      "globalPeriod": 3,
      "startTime": "09:15",
      "endTime": "10:00"
    },
    {
      "id": "ts_d6_m_4",
      "dayOfWeek": 6,
      "dayName": "Thứ 6",
      "session": "MORNING",
      "period": 4,
      "globalPeriod": 4,
      "startTime": "10:20",
      "endTime": "11:05"
    },
    {
      "id": "ts_d6_m_5",
      "dayOfWeek": 6,
      "dayName": "Thứ 6",
      "session": "MORNING",
      "period": 5,
      "globalPeriod": 5,
      "startTime": "11:05",
      "endTime": "11:50"
    },
    {
      "id": "ts_d6_a_1",
      "dayOfWeek": 6,
      "dayName": "Thứ 6",
      "session": "AFTERNOON",
      "period": 1,
      "globalPeriod": 6,
      "startTime": "13:30",
      "endTime": "14:10"
    },
    {
      "id": "ts_d6_a_2",
      "dayOfWeek": 6,
      "dayName": "Thứ 6",
      "session": "AFTERNOON",
      "period": 2,
      "globalPeriod": 7,
      "startTime": "14:10",
      "endTime": "14:50"
    },
    {
      "id": "ts_d6_a_3",
      "dayOfWeek": 6,
      "dayName": "Thứ 6",
      "session": "AFTERNOON",
      "period": 3,
      "globalPeriod": 8,
      "startTime": "15:10",
      "endTime": "15:50"
    },
    {
      "id": "ts_d6_a_4",
      "dayOfWeek": 6,
      "dayName": "Thứ 6",
      "session": "AFTERNOON",
      "period": 4,
      "globalPeriod": 9,
      "startTime": "15:50",
      "endTime": "16:30"
    }
  ],
  "timetableCells": [
    {
      "id": "initial_0",
      "classId": "cls_6a1",
      "timeSlotId": "ts_d2_m_1",
      "subjectId": "subj_special_chao_co",
      "teacherId": "",
      "locked": true,
      "note": "HĐTN-HN: Sinh hoạt dưới cờ (Chào cờ)"
    },
    {
      "id": "initial_1",
      "classId": "cls_6a1",
      "timeSlotId": "ts_d2_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_2",
      "classId": "cls_6a1",
      "timeSlotId": "ts_d2_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_3",
      "classId": "cls_6a1",
      "timeSlotId": "ts_d2_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_4",
      "classId": "cls_6a1",
      "timeSlotId": "ts_d2_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_5",
      "classId": "cls_6a1",
      "timeSlotId": "ts_d4_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_6",
      "classId": "cls_6a1",
      "timeSlotId": "ts_d4_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_7",
      "classId": "cls_6a1",
      "timeSlotId": "ts_d4_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_8",
      "classId": "cls_6a1",
      "timeSlotId": "ts_d4_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_9",
      "classId": "cls_6a1",
      "timeSlotId": "ts_d6_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_10",
      "classId": "cls_6a1",
      "timeSlotId": "ts_d6_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_11",
      "classId": "cls_6a1",
      "timeSlotId": "ts_d6_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_12",
      "classId": "cls_6a1",
      "timeSlotId": "ts_d6_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_13",
      "classId": "cls_6a1",
      "timeSlotId": "ts_d3_a_3",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_14",
      "classId": "cls_6a1",
      "timeSlotId": "ts_d3_a_4",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_15",
      "classId": "cls_6a1",
      "timeSlotId": "ts_d5_a_3",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_16",
      "classId": "cls_6a1",
      "timeSlotId": "ts_d5_a_4",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_17",
      "classId": "cls_6a2",
      "timeSlotId": "ts_d2_m_1",
      "subjectId": "subj_special_chao_co",
      "teacherId": "",
      "locked": true,
      "note": "HĐTN-HN: Sinh hoạt dưới cờ (Chào cờ)"
    },
    {
      "id": "initial_18",
      "classId": "cls_6a2",
      "timeSlotId": "ts_d2_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_19",
      "classId": "cls_6a2",
      "timeSlotId": "ts_d2_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_20",
      "classId": "cls_6a2",
      "timeSlotId": "ts_d2_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_21",
      "classId": "cls_6a2",
      "timeSlotId": "ts_d2_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_22",
      "classId": "cls_6a2",
      "timeSlotId": "ts_d4_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_23",
      "classId": "cls_6a2",
      "timeSlotId": "ts_d4_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_24",
      "classId": "cls_6a2",
      "timeSlotId": "ts_d4_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_25",
      "classId": "cls_6a2",
      "timeSlotId": "ts_d4_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_26",
      "classId": "cls_6a2",
      "timeSlotId": "ts_d6_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_27",
      "classId": "cls_6a2",
      "timeSlotId": "ts_d6_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_28",
      "classId": "cls_6a2",
      "timeSlotId": "ts_d6_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_29",
      "classId": "cls_6a2",
      "timeSlotId": "ts_d6_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_30",
      "classId": "cls_6a2",
      "timeSlotId": "ts_d3_a_3",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_31",
      "classId": "cls_6a2",
      "timeSlotId": "ts_d3_a_4",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_32",
      "classId": "cls_6a2",
      "timeSlotId": "ts_d5_a_3",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_33",
      "classId": "cls_6a2",
      "timeSlotId": "ts_d5_a_4",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_34",
      "classId": "cls_6a3",
      "timeSlotId": "ts_d2_m_1",
      "subjectId": "subj_special_chao_co",
      "teacherId": "",
      "locked": true,
      "note": "HĐTN-HN: Sinh hoạt dưới cờ (Chào cờ)"
    },
    {
      "id": "initial_35",
      "classId": "cls_6a3",
      "timeSlotId": "ts_d2_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_36",
      "classId": "cls_6a3",
      "timeSlotId": "ts_d2_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_37",
      "classId": "cls_6a3",
      "timeSlotId": "ts_d2_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_38",
      "classId": "cls_6a3",
      "timeSlotId": "ts_d2_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_39",
      "classId": "cls_6a3",
      "timeSlotId": "ts_d4_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_40",
      "classId": "cls_6a3",
      "timeSlotId": "ts_d4_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_41",
      "classId": "cls_6a3",
      "timeSlotId": "ts_d4_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_42",
      "classId": "cls_6a3",
      "timeSlotId": "ts_d4_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_43",
      "classId": "cls_6a3",
      "timeSlotId": "ts_d6_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_44",
      "classId": "cls_6a3",
      "timeSlotId": "ts_d6_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_45",
      "classId": "cls_6a3",
      "timeSlotId": "ts_d6_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_46",
      "classId": "cls_6a3",
      "timeSlotId": "ts_d6_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_47",
      "classId": "cls_6a3",
      "timeSlotId": "ts_d3_a_3",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_48",
      "classId": "cls_6a3",
      "timeSlotId": "ts_d3_a_4",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_49",
      "classId": "cls_6a3",
      "timeSlotId": "ts_d5_a_3",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_50",
      "classId": "cls_6a3",
      "timeSlotId": "ts_d5_a_4",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_51",
      "classId": "cls_7a1",
      "timeSlotId": "ts_d2_m_1",
      "subjectId": "subj_special_chao_co",
      "teacherId": "",
      "locked": true,
      "note": "HĐTN-HN: Sinh hoạt dưới cờ (Chào cờ)"
    },
    {
      "id": "initial_52",
      "classId": "cls_7a1",
      "timeSlotId": "ts_d2_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_53",
      "classId": "cls_7a1",
      "timeSlotId": "ts_d2_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_54",
      "classId": "cls_7a1",
      "timeSlotId": "ts_d2_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_55",
      "classId": "cls_7a1",
      "timeSlotId": "ts_d2_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_56",
      "classId": "cls_7a1",
      "timeSlotId": "ts_d4_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_57",
      "classId": "cls_7a1",
      "timeSlotId": "ts_d4_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_58",
      "classId": "cls_7a1",
      "timeSlotId": "ts_d4_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_59",
      "classId": "cls_7a1",
      "timeSlotId": "ts_d4_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_60",
      "classId": "cls_7a1",
      "timeSlotId": "ts_d6_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_61",
      "classId": "cls_7a1",
      "timeSlotId": "ts_d6_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_62",
      "classId": "cls_7a1",
      "timeSlotId": "ts_d6_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_63",
      "classId": "cls_7a1",
      "timeSlotId": "ts_d6_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_64",
      "classId": "cls_7a1",
      "timeSlotId": "ts_d3_a_3",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_65",
      "classId": "cls_7a1",
      "timeSlotId": "ts_d3_a_4",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_66",
      "classId": "cls_7a1",
      "timeSlotId": "ts_d5_a_3",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_67",
      "classId": "cls_7a1",
      "timeSlotId": "ts_d5_a_4",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_68",
      "classId": "cls_7a2",
      "timeSlotId": "ts_d2_m_1",
      "subjectId": "subj_special_chao_co",
      "teacherId": "",
      "locked": true,
      "note": "HĐTN-HN: Sinh hoạt dưới cờ (Chào cờ)"
    },
    {
      "id": "initial_69",
      "classId": "cls_7a2",
      "timeSlotId": "ts_d2_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_70",
      "classId": "cls_7a2",
      "timeSlotId": "ts_d2_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_71",
      "classId": "cls_7a2",
      "timeSlotId": "ts_d2_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_72",
      "classId": "cls_7a2",
      "timeSlotId": "ts_d2_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_73",
      "classId": "cls_7a2",
      "timeSlotId": "ts_d4_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_74",
      "classId": "cls_7a2",
      "timeSlotId": "ts_d4_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_75",
      "classId": "cls_7a2",
      "timeSlotId": "ts_d4_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_76",
      "classId": "cls_7a2",
      "timeSlotId": "ts_d4_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_77",
      "classId": "cls_7a2",
      "timeSlotId": "ts_d6_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_78",
      "classId": "cls_7a2",
      "timeSlotId": "ts_d6_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_79",
      "classId": "cls_7a2",
      "timeSlotId": "ts_d6_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_80",
      "classId": "cls_7a2",
      "timeSlotId": "ts_d6_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_81",
      "classId": "cls_7a2",
      "timeSlotId": "ts_d3_a_3",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_82",
      "classId": "cls_7a2",
      "timeSlotId": "ts_d3_a_4",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_83",
      "classId": "cls_7a2",
      "timeSlotId": "ts_d5_a_3",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_84",
      "classId": "cls_7a2",
      "timeSlotId": "ts_d5_a_4",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_85",
      "classId": "cls_7a3",
      "timeSlotId": "ts_d2_m_1",
      "subjectId": "subj_special_chao_co",
      "teacherId": "",
      "locked": true,
      "note": "HĐTN-HN: Sinh hoạt dưới cờ (Chào cờ)"
    },
    {
      "id": "initial_86",
      "classId": "cls_7a3",
      "timeSlotId": "ts_d2_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_87",
      "classId": "cls_7a3",
      "timeSlotId": "ts_d2_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_88",
      "classId": "cls_7a3",
      "timeSlotId": "ts_d2_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_89",
      "classId": "cls_7a3",
      "timeSlotId": "ts_d2_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_90",
      "classId": "cls_7a3",
      "timeSlotId": "ts_d4_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_91",
      "classId": "cls_7a3",
      "timeSlotId": "ts_d4_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_92",
      "classId": "cls_7a3",
      "timeSlotId": "ts_d4_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_93",
      "classId": "cls_7a3",
      "timeSlotId": "ts_d4_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_94",
      "classId": "cls_7a3",
      "timeSlotId": "ts_d6_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_95",
      "classId": "cls_7a3",
      "timeSlotId": "ts_d6_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_96",
      "classId": "cls_7a3",
      "timeSlotId": "ts_d6_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_97",
      "classId": "cls_7a3",
      "timeSlotId": "ts_d6_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_98",
      "classId": "cls_7a3",
      "timeSlotId": "ts_d3_a_3",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_99",
      "classId": "cls_7a3",
      "timeSlotId": "ts_d3_a_4",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_100",
      "classId": "cls_7a3",
      "timeSlotId": "ts_d5_a_3",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_101",
      "classId": "cls_7a3",
      "timeSlotId": "ts_d5_a_4",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_102",
      "classId": "cls_8a1",
      "timeSlotId": "ts_d2_m_1",
      "subjectId": "subj_special_chao_co",
      "teacherId": "",
      "locked": true,
      "note": "HĐTN-HN: Sinh hoạt dưới cờ (Chào cờ)"
    },
    {
      "id": "initial_103",
      "classId": "cls_8a1",
      "timeSlotId": "ts_d2_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_104",
      "classId": "cls_8a1",
      "timeSlotId": "ts_d2_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_105",
      "classId": "cls_8a1",
      "timeSlotId": "ts_d2_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_106",
      "classId": "cls_8a1",
      "timeSlotId": "ts_d2_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_107",
      "classId": "cls_8a1",
      "timeSlotId": "ts_d4_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_108",
      "classId": "cls_8a1",
      "timeSlotId": "ts_d4_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_109",
      "classId": "cls_8a1",
      "timeSlotId": "ts_d4_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_110",
      "classId": "cls_8a1",
      "timeSlotId": "ts_d4_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_111",
      "classId": "cls_8a1",
      "timeSlotId": "ts_d6_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_112",
      "classId": "cls_8a1",
      "timeSlotId": "ts_d6_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_113",
      "classId": "cls_8a1",
      "timeSlotId": "ts_d6_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_114",
      "classId": "cls_8a1",
      "timeSlotId": "ts_d6_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_115",
      "classId": "cls_8a1",
      "timeSlotId": "ts_d3_a_3",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_116",
      "classId": "cls_8a1",
      "timeSlotId": "ts_d3_a_4",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_117",
      "classId": "cls_8a1",
      "timeSlotId": "ts_d5_a_3",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_118",
      "classId": "cls_8a1",
      "timeSlotId": "ts_d5_a_4",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_119",
      "classId": "cls_8a2",
      "timeSlotId": "ts_d2_m_1",
      "subjectId": "subj_special_chao_co",
      "teacherId": "",
      "locked": true,
      "note": "HĐTN-HN: Sinh hoạt dưới cờ (Chào cờ)"
    },
    {
      "id": "initial_120",
      "classId": "cls_8a2",
      "timeSlotId": "ts_d2_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_121",
      "classId": "cls_8a2",
      "timeSlotId": "ts_d2_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_122",
      "classId": "cls_8a2",
      "timeSlotId": "ts_d2_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_123",
      "classId": "cls_8a2",
      "timeSlotId": "ts_d2_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_124",
      "classId": "cls_8a2",
      "timeSlotId": "ts_d4_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_125",
      "classId": "cls_8a2",
      "timeSlotId": "ts_d4_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_126",
      "classId": "cls_8a2",
      "timeSlotId": "ts_d4_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_127",
      "classId": "cls_8a2",
      "timeSlotId": "ts_d4_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_128",
      "classId": "cls_8a2",
      "timeSlotId": "ts_d6_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_129",
      "classId": "cls_8a2",
      "timeSlotId": "ts_d6_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_130",
      "classId": "cls_8a2",
      "timeSlotId": "ts_d6_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_131",
      "classId": "cls_8a2",
      "timeSlotId": "ts_d6_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_132",
      "classId": "cls_8a2",
      "timeSlotId": "ts_d3_a_3",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_133",
      "classId": "cls_8a2",
      "timeSlotId": "ts_d3_a_4",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_134",
      "classId": "cls_8a2",
      "timeSlotId": "ts_d5_a_3",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_135",
      "classId": "cls_8a2",
      "timeSlotId": "ts_d5_a_4",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_136",
      "classId": "cls_8a3",
      "timeSlotId": "ts_d2_m_1",
      "subjectId": "subj_special_chao_co",
      "teacherId": "",
      "locked": true,
      "note": "HĐTN-HN: Sinh hoạt dưới cờ (Chào cờ)"
    },
    {
      "id": "initial_137",
      "classId": "cls_8a3",
      "timeSlotId": "ts_d2_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_138",
      "classId": "cls_8a3",
      "timeSlotId": "ts_d2_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_139",
      "classId": "cls_8a3",
      "timeSlotId": "ts_d2_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_140",
      "classId": "cls_8a3",
      "timeSlotId": "ts_d2_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_141",
      "classId": "cls_8a3",
      "timeSlotId": "ts_d4_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_142",
      "classId": "cls_8a3",
      "timeSlotId": "ts_d4_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_143",
      "classId": "cls_8a3",
      "timeSlotId": "ts_d4_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_144",
      "classId": "cls_8a3",
      "timeSlotId": "ts_d4_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_145",
      "classId": "cls_8a3",
      "timeSlotId": "ts_d6_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_146",
      "classId": "cls_8a3",
      "timeSlotId": "ts_d6_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_147",
      "classId": "cls_8a3",
      "timeSlotId": "ts_d6_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_148",
      "classId": "cls_8a3",
      "timeSlotId": "ts_d6_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_149",
      "classId": "cls_8a3",
      "timeSlotId": "ts_d3_a_3",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_150",
      "classId": "cls_8a3",
      "timeSlotId": "ts_d3_a_4",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_151",
      "classId": "cls_8a3",
      "timeSlotId": "ts_d5_a_3",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_152",
      "classId": "cls_8a3",
      "timeSlotId": "ts_d5_a_4",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_153",
      "classId": "cls_9a1",
      "timeSlotId": "ts_d2_m_1",
      "subjectId": "subj_special_chao_co",
      "teacherId": "",
      "locked": true,
      "note": "HĐTN-HN: Sinh hoạt dưới cờ (Chào cờ)"
    },
    {
      "id": "initial_154",
      "classId": "cls_9a1",
      "timeSlotId": "ts_d2_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_155",
      "classId": "cls_9a1",
      "timeSlotId": "ts_d2_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_156",
      "classId": "cls_9a1",
      "timeSlotId": "ts_d2_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_157",
      "classId": "cls_9a1",
      "timeSlotId": "ts_d2_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_158",
      "classId": "cls_9a1",
      "timeSlotId": "ts_d4_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_159",
      "classId": "cls_9a1",
      "timeSlotId": "ts_d4_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_160",
      "classId": "cls_9a1",
      "timeSlotId": "ts_d4_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_161",
      "classId": "cls_9a1",
      "timeSlotId": "ts_d4_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_162",
      "classId": "cls_9a1",
      "timeSlotId": "ts_d6_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_163",
      "classId": "cls_9a1",
      "timeSlotId": "ts_d6_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_164",
      "classId": "cls_9a1",
      "timeSlotId": "ts_d6_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_165",
      "classId": "cls_9a1",
      "timeSlotId": "ts_d6_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_166",
      "classId": "cls_9a1",
      "timeSlotId": "ts_d3_a_3",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_167",
      "classId": "cls_9a1",
      "timeSlotId": "ts_d3_a_4",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_168",
      "classId": "cls_9a1",
      "timeSlotId": "ts_d5_a_3",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_169",
      "classId": "cls_9a1",
      "timeSlotId": "ts_d5_a_4",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_170",
      "classId": "cls_9a2",
      "timeSlotId": "ts_d2_m_1",
      "subjectId": "subj_special_chao_co",
      "teacherId": "",
      "locked": true,
      "note": "HĐTN-HN: Sinh hoạt dưới cờ (Chào cờ)"
    },
    {
      "id": "initial_171",
      "classId": "cls_9a2",
      "timeSlotId": "ts_d2_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_172",
      "classId": "cls_9a2",
      "timeSlotId": "ts_d2_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_173",
      "classId": "cls_9a2",
      "timeSlotId": "ts_d2_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_174",
      "classId": "cls_9a2",
      "timeSlotId": "ts_d2_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_175",
      "classId": "cls_9a2",
      "timeSlotId": "ts_d4_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_176",
      "classId": "cls_9a2",
      "timeSlotId": "ts_d4_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_177",
      "classId": "cls_9a2",
      "timeSlotId": "ts_d4_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_178",
      "classId": "cls_9a2",
      "timeSlotId": "ts_d4_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_179",
      "classId": "cls_9a2",
      "timeSlotId": "ts_d6_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_180",
      "classId": "cls_9a2",
      "timeSlotId": "ts_d6_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_181",
      "classId": "cls_9a2",
      "timeSlotId": "ts_d6_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_182",
      "classId": "cls_9a2",
      "timeSlotId": "ts_d6_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_183",
      "classId": "cls_9a2",
      "timeSlotId": "ts_d3_a_3",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_184",
      "classId": "cls_9a2",
      "timeSlotId": "ts_d3_a_4",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_185",
      "classId": "cls_9a2",
      "timeSlotId": "ts_d5_a_3",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_186",
      "classId": "cls_9a2",
      "timeSlotId": "ts_d5_a_4",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_187",
      "classId": "cls_9a3",
      "timeSlotId": "ts_d2_m_1",
      "subjectId": "subj_special_chao_co",
      "teacherId": "",
      "locked": true,
      "note": "HĐTN-HN: Sinh hoạt dưới cờ (Chào cờ)"
    },
    {
      "id": "initial_188",
      "classId": "cls_9a3",
      "timeSlotId": "ts_d2_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_189",
      "classId": "cls_9a3",
      "timeSlotId": "ts_d2_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_190",
      "classId": "cls_9a3",
      "timeSlotId": "ts_d2_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_191",
      "classId": "cls_9a3",
      "timeSlotId": "ts_d2_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_192",
      "classId": "cls_9a3",
      "timeSlotId": "ts_d4_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_193",
      "classId": "cls_9a3",
      "timeSlotId": "ts_d4_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_194",
      "classId": "cls_9a3",
      "timeSlotId": "ts_d4_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_195",
      "classId": "cls_9a3",
      "timeSlotId": "ts_d4_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_196",
      "classId": "cls_9a3",
      "timeSlotId": "ts_d6_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_197",
      "classId": "cls_9a3",
      "timeSlotId": "ts_d6_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_198",
      "classId": "cls_9a3",
      "timeSlotId": "ts_d6_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_199",
      "classId": "cls_9a3",
      "timeSlotId": "ts_d6_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_200",
      "classId": "cls_9a3",
      "timeSlotId": "ts_d3_a_3",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_201",
      "classId": "cls_9a3",
      "timeSlotId": "ts_d3_a_4",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_202",
      "classId": "cls_9a3",
      "timeSlotId": "ts_d5_a_3",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_203",
      "classId": "cls_9a3",
      "timeSlotId": "ts_d5_a_4",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_204",
      "classId": "cls_10tn",
      "timeSlotId": "ts_d2_m_1",
      "subjectId": "subj_special_chao_co",
      "teacherId": "",
      "locked": true,
      "note": "HĐTN-HN: Sinh hoạt dưới cờ (Chào cờ)"
    },
    {
      "id": "initial_205",
      "classId": "cls_10tn",
      "timeSlotId": "ts_d2_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_206",
      "classId": "cls_10tn",
      "timeSlotId": "ts_d2_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_207",
      "classId": "cls_10tn",
      "timeSlotId": "ts_d2_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_208",
      "classId": "cls_10tn",
      "timeSlotId": "ts_d2_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_209",
      "classId": "cls_10tn",
      "timeSlotId": "ts_d4_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_210",
      "classId": "cls_10tn",
      "timeSlotId": "ts_d4_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_211",
      "classId": "cls_10tn",
      "timeSlotId": "ts_d4_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_212",
      "classId": "cls_10tn",
      "timeSlotId": "ts_d4_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_213",
      "classId": "cls_10tn",
      "timeSlotId": "ts_d6_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_214",
      "classId": "cls_10tn",
      "timeSlotId": "ts_d6_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_215",
      "classId": "cls_10tn",
      "timeSlotId": "ts_d6_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_216",
      "classId": "cls_10tn",
      "timeSlotId": "ts_d6_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_217",
      "classId": "cls_10tn",
      "timeSlotId": "ts_d3_a_3",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_218",
      "classId": "cls_10tn",
      "timeSlotId": "ts_d3_a_4",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_219",
      "classId": "cls_10tn",
      "timeSlotId": "ts_d5_a_3",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_220",
      "classId": "cls_10tn",
      "timeSlotId": "ts_d5_a_4",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_221",
      "classId": "cls_10xh",
      "timeSlotId": "ts_d2_m_1",
      "subjectId": "subj_special_chao_co",
      "teacherId": "",
      "locked": true,
      "note": "HĐTN-HN: Sinh hoạt dưới cờ (Chào cờ)"
    },
    {
      "id": "initial_222",
      "classId": "cls_10xh",
      "timeSlotId": "ts_d2_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_223",
      "classId": "cls_10xh",
      "timeSlotId": "ts_d2_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_224",
      "classId": "cls_10xh",
      "timeSlotId": "ts_d2_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_225",
      "classId": "cls_10xh",
      "timeSlotId": "ts_d2_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_226",
      "classId": "cls_10xh",
      "timeSlotId": "ts_d4_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_227",
      "classId": "cls_10xh",
      "timeSlotId": "ts_d4_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_228",
      "classId": "cls_10xh",
      "timeSlotId": "ts_d4_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_229",
      "classId": "cls_10xh",
      "timeSlotId": "ts_d4_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_230",
      "classId": "cls_10xh",
      "timeSlotId": "ts_d6_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_231",
      "classId": "cls_10xh",
      "timeSlotId": "ts_d6_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_232",
      "classId": "cls_10xh",
      "timeSlotId": "ts_d6_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_233",
      "classId": "cls_10xh",
      "timeSlotId": "ts_d6_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_234",
      "classId": "cls_10xh",
      "timeSlotId": "ts_d3_a_3",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_235",
      "classId": "cls_10xh",
      "timeSlotId": "ts_d3_a_4",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_236",
      "classId": "cls_10xh",
      "timeSlotId": "ts_d5_a_3",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_237",
      "classId": "cls_10xh",
      "timeSlotId": "ts_d5_a_4",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_238",
      "classId": "cls_11",
      "timeSlotId": "ts_d2_m_1",
      "subjectId": "subj_special_chao_co",
      "teacherId": "",
      "locked": true,
      "note": "HĐTN-HN: Sinh hoạt dưới cờ (Chào cờ)"
    },
    {
      "id": "initial_239",
      "classId": "cls_11",
      "timeSlotId": "ts_d2_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_240",
      "classId": "cls_11",
      "timeSlotId": "ts_d2_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_241",
      "classId": "cls_11",
      "timeSlotId": "ts_d2_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_242",
      "classId": "cls_11",
      "timeSlotId": "ts_d2_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_243",
      "classId": "cls_11",
      "timeSlotId": "ts_d4_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_244",
      "classId": "cls_11",
      "timeSlotId": "ts_d4_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_245",
      "classId": "cls_11",
      "timeSlotId": "ts_d4_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_246",
      "classId": "cls_11",
      "timeSlotId": "ts_d4_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_247",
      "classId": "cls_11",
      "timeSlotId": "ts_d6_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_248",
      "classId": "cls_11",
      "timeSlotId": "ts_d6_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_249",
      "classId": "cls_11",
      "timeSlotId": "ts_d6_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_250",
      "classId": "cls_11",
      "timeSlotId": "ts_d6_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_251",
      "classId": "cls_11",
      "timeSlotId": "ts_d3_a_3",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_252",
      "classId": "cls_11",
      "timeSlotId": "ts_d3_a_4",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_253",
      "classId": "cls_11",
      "timeSlotId": "ts_d5_a_3",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_254",
      "classId": "cls_11",
      "timeSlotId": "ts_d5_a_4",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_255",
      "classId": "cls_12tn",
      "timeSlotId": "ts_d2_m_1",
      "subjectId": "subj_special_chao_co",
      "teacherId": "",
      "locked": true,
      "note": "HĐTN-HN: Sinh hoạt dưới cờ (Chào cờ)"
    },
    {
      "id": "initial_256",
      "classId": "cls_12tn",
      "timeSlotId": "ts_d2_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_257",
      "classId": "cls_12tn",
      "timeSlotId": "ts_d2_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_258",
      "classId": "cls_12tn",
      "timeSlotId": "ts_d2_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_259",
      "classId": "cls_12tn",
      "timeSlotId": "ts_d2_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_260",
      "classId": "cls_12tn",
      "timeSlotId": "ts_d4_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_261",
      "classId": "cls_12tn",
      "timeSlotId": "ts_d4_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_262",
      "classId": "cls_12tn",
      "timeSlotId": "ts_d4_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_263",
      "classId": "cls_12tn",
      "timeSlotId": "ts_d4_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_264",
      "classId": "cls_12tn",
      "timeSlotId": "ts_d6_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_265",
      "classId": "cls_12tn",
      "timeSlotId": "ts_d6_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_266",
      "classId": "cls_12tn",
      "timeSlotId": "ts_d6_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_267",
      "classId": "cls_12tn",
      "timeSlotId": "ts_d6_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_268",
      "classId": "cls_12tn",
      "timeSlotId": "ts_d3_a_3",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_269",
      "classId": "cls_12tn",
      "timeSlotId": "ts_d3_a_4",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_270",
      "classId": "cls_12tn",
      "timeSlotId": "ts_d5_a_3",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_271",
      "classId": "cls_12tn",
      "timeSlotId": "ts_d5_a_4",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_272",
      "classId": "cls_12xh",
      "timeSlotId": "ts_d2_m_1",
      "subjectId": "subj_special_chao_co",
      "teacherId": "",
      "locked": true,
      "note": "HĐTN-HN: Sinh hoạt dưới cờ (Chào cờ)"
    },
    {
      "id": "initial_273",
      "classId": "cls_12xh",
      "timeSlotId": "ts_d2_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_274",
      "classId": "cls_12xh",
      "timeSlotId": "ts_d2_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_275",
      "classId": "cls_12xh",
      "timeSlotId": "ts_d2_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_276",
      "classId": "cls_12xh",
      "timeSlotId": "ts_d2_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_277",
      "classId": "cls_12xh",
      "timeSlotId": "ts_d4_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_278",
      "classId": "cls_12xh",
      "timeSlotId": "ts_d4_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_279",
      "classId": "cls_12xh",
      "timeSlotId": "ts_d4_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_280",
      "classId": "cls_12xh",
      "timeSlotId": "ts_d4_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_281",
      "classId": "cls_12xh",
      "timeSlotId": "ts_d6_a_1",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_282",
      "classId": "cls_12xh",
      "timeSlotId": "ts_d6_a_2",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_283",
      "classId": "cls_12xh",
      "timeSlotId": "ts_d6_a_3",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_284",
      "classId": "cls_12xh",
      "timeSlotId": "ts_d6_a_4",
      "subjectId": "subj_ta_esl",
      "teacherId": "",
      "locked": true,
      "note": "Tiếng Anh ESL (Cố định chiều T2, T4, T6)"
    },
    {
      "id": "initial_285",
      "classId": "cls_12xh",
      "timeSlotId": "ts_d3_a_3",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_286",
      "classId": "cls_12xh",
      "timeSlotId": "ts_d3_a_4",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_287",
      "classId": "cls_12xh",
      "timeSlotId": "ts_d5_a_3",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    },
    {
      "id": "initial_288",
      "classId": "cls_12xh",
      "timeSlotId": "ts_d5_a_4",
      "subjectId": "subj_clb",
      "teacherId": "",
      "locked": true,
      "note": "Hoạt động CLB (Cố định chiều T3 & T5 tiết 3, 4)"
    }
  ],
  "versions": [],
  "published": null
};

const clbClassesT3 = new Set(['cls_8a1', 'cls_8a2', 'cls_8a3', 'cls_9a1', 'cls_9a2', 'cls_9a3', 'cls_10tn', 'cls_10xh', 'cls_11']);
const clbClassesT5 = new Set(['cls_6a1', 'cls_6a2', 'cls_6a3', 'cls_7a1', 'cls_7a2', 'cls_7a3']);

export const SEED = {
  ...RAW_SEED,
  timetableCells: RAW_SEED.timetableCells.filter(cell => {
    const { classId, timeSlotId, subjectId } = cell;

    // 1. Xoá tiết cố định TA ESL ở 2 lớp 12XH và 12TN vào các tiết chiều thứ 2, thứ tư, thứ sáu
    if ((classId === 'cls_12xh' || classId === 'cls_12tn') &&
        subjectId === 'subj_ta_esl' &&
        /^ts_d[246]_a_[1-4]$/.test(timeSlotId)) {
      return false;
    }

    // 2. Chiều thứ 3 lớp 8A1, 8A2, 8A3, 9A1, 9A2, 9A3, 10TN, 10XH và 11 xoá tiết 3, 4 cố định CLB
    if (clbClassesT3.has(classId) &&
        subjectId === 'subj_clb' &&
        (timeSlotId === 'ts_d3_a_3' || timeSlotId === 'ts_d3_a_4')) {
      return false;
    }

    // 3. Chiều thứ 5 lớp 6A1, 6A2, 6A3, 7A1, 7A2, 7A3 xoá tiết 3, 4 cố định CLB
    if (clbClassesT5.has(classId) &&
        subjectId === 'subj_clb' &&
        (timeSlotId === 'ts_d5_a_3' || timeSlotId === 'ts_d5_a_4')) {
      return false;
    }

    // 4. Lớp 12TN và 12XH thứ 3 và thứ 5 chiều tiết 3-4 không có tiết câu lạc bộ
    if ((classId === 'cls_12xh' || classId === 'cls_12tn') &&
        subjectId === 'subj_clb' &&
        (timeSlotId === 'ts_d3_a_3' || timeSlotId === 'ts_d3_a_4' || timeSlotId === 'ts_d5_a_3' || timeSlotId === 'ts_d5_a_4')) {
      return false;
    }

    return true;
  })
};
