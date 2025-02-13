import os
import cv2
import requests
import logging  # Added for better error tracking
from typing import Dict, Union  # Added type hints
import numpy as np
from PIL import ImageFont, ImageDraw, Image
from flask import Flask, jsonify  # Added jsonify for better JSON responses
from flask_restful import reqparse, Api, Resource

# Moved constants to top level for better organization
FONT_PATH = "ResourceHanRoundedCN-Regular.ttf"
FONT_SIZE_LARGE = 80
FONT_SIZE_SMALL = 60
IMAGE_WIDTH = 1800
IMAGE_HEIGHT = 300
MAX_TEXT_LENGTH = 12

# Each level needs 1.3 times exp compared to the previous level
# ExpLevelMapping contains exp value needed for each level
# ExpTotalMapping contains exp value needed in total for reaching a certain level
EXP_PER_LVL = {1: 10}
CACHE_EXP_PER_LVL = {1: 10}
EXP_TOTAL_LVL = {1: 10}
EXP_FACTOR = 1.30
LVL_UPPER_BOUND = 2000

for i in range(2, LVL_UPPER_BOUND + 1):
    # round next_lvl_exp to the nearest 5 multiply interger
    CACHE_EXP_PER_LVL[i] = CACHE_EXP_PER_LVL[i - 1] * EXP_FACTOR
    next_lvl_exp = round(CACHE_EXP_PER_LVL[i - 1] * EXP_FACTOR / 5) * 5
    EXP_PER_LVL[i] = next_lvl_exp if next_lvl_exp < 3000 else 3000
    EXP_TOTAL_LVL[i] = EXP_TOTAL_LVL[i - 1] + EXP_PER_LVL[i]

# Added type hints and organized constants
RANK_NAMES: Dict[str, str] = {
    "0-0": "不堪一击（需要完成初始任务）",
    "1-4": "初学乍练",
    "5-9": "略有所成",
    "10-14": "小试锋芒",
    "15-19": "渐入佳境",
    "20-24": "心领神会",
    "25-29": "融会贯通",
    "30-34": "出类拔萃",
    "35-39": "炉火纯青",
    "40-44": "登堂入室",
    "45-49": "名震一方",
    "50-54": "超凡脱俗",
    "55-59": "登峰造极",
    "60-64": "傲视群雄",
    "65-69": "独步天下",
    "70-74": "威震四海",
    "75-79": "举世无双",
    "80-84": "破碎虚空",
    "85-89": "天人合一",
    "90-94": "超凡入圣",
    "95-99": "返璞归真",
    "100-104": "大道至简",
    "105-109": "万象归一",
    "110-114": "乾坤无极",
    "115-119": "星辰变",
    "120-124": "虚空行者",
    "125-129": "混沌初开",
    "130-134": "天道轮回",
    "135-139": "万法归宗",
    "140-144": "宇宙洪荒",
    "145-149": "永恒之境",
    "150-154": "创世之神",
    "155-159": "时空主宰",
    "160-164": "维度掌控者",
    "165-169": "命运编织者",
    "170-174": "万物起源",
    "175-179": "无限之巅",
    "180-184": "超脱轮回",
    "185-189": "终极真理",
    "190-194": "永恒不朽",
    "195-199": "无尽传说",
    "200-2000": "你他娘的肯定是三体人吧"
}

ROLE_NAMES: Dict[int, str] = {
    0: "超管",
    1: "管理员",
    2: "资深会员",
    3: "普通会员",
}

# Initialize fonts once, not on every function call
try:
    font = ImageFont.truetype(FONT_PATH, FONT_SIZE_LARGE)
    font_small = ImageFont.truetype(FONT_PATH, FONT_SIZE_SMALL)
except IOError as e:
    logging.error(f"Font loading failed: {e}")
    raise


def find_rank_name(level: int) -> int:
    for key in RANK_NAMES:
        start, end = key.split("-")
        if int(start) <= level <= int(end):
            return RANK_NAMES[key]
    return "尚未参与评级"


def calculate_current_levelexp(exp: int) -> int:
    exp_current_level = exp
    level = 1
    for i in range(1, LVL_UPPER_BOUND + 1):
        if exp >= EXP_TOTAL_LVL[i]:
            level = i + 1
            exp_current_level -= EXP_PER_LVL[i]
        else:
            break
    return level, exp_current_level


def trim_text(text: str, max_length: int = MAX_TEXT_LENGTH) -> str:
    return f"{text[:max_length]}..." if len(text) > max_length else text


def build_profile_image(payload: Dict[str, Union[str, int]]) -> None:
    try:
        avatar_url = f'https://cdn.discordapp.com/avatars/{payload["dcId"]}/{payload["avatarId"]}.png'
        canvas = cv2.resize(
            cv2.imread("source.png", cv2.IMREAD_COLOR), (IMAGE_WIDTH, IMAGE_HEIGHT)
        )
        level, exp_current_level = calculate_current_levelexp(payload["exp"])
        if not payload["qualified"]:
            level = 0
            exp_current_level = 0

        # Improved avatar handling with context manager
        try:
            response = requests.get(avatar_url, timeout=5)  # Added timeout
            response.raise_for_status()  # Check for HTTP errors

            with open("avatar.jpg", "wb") as f:
                f.write(response.content)

            avatar = cv2.resize(cv2.imread("avatar.jpg", cv2.IMREAD_COLOR), (225, 225))
            canvas[35:260, 90:315] = avatar
        except (requests.RequestException, cv2.error) as e:
            logging.warning(f"Avatar loading failed: {e}")
            canvas[35:260, 90:315] = 0

        # Convert to PIL Image once instead of multiple conversions
        img_pil = Image.fromarray(canvas)
        draw = ImageDraw.Draw(img_pil)

        # Consolidated drawing calls with calculated positions
        positions = {
            "name": (int(0.23 * IMAGE_WIDTH), int(0.04 * IMAGE_HEIGHT)),
            "level": (int(0.23 * IMAGE_WIDTH), int(0.40 * IMAGE_HEIGHT)),
            "rank": (int(0.40 * IMAGE_WIDTH), int(0.40 * IMAGE_HEIGHT)),
        }

        draw.text(
            positions["name"],
            trim_text(payload["dcName"] or ""),
            font=font,
            fill=(220, 120, 120, 0),
        )
        draw.text(
            positions["level"], f"等级: {level}", font=font_small, fill=(150, 180, 200, 0)
        )
        draw.text(
            positions["rank"],
            f"会阶: {find_rank_name(level)}",
            font=font_small,
            fill=(220, 220, 220, 0),
        )

        canvas = np.array(img_pil)

        # Experience bar calculations improved for clarity
        exp_ratio = exp_current_level / (EXP_PER_LVL[level] + 1e-3) if level > 0 else 0
        bar_width = int(0.49 * exp_ratio * IMAGE_WIDTH)

        # Draw experience bar
        cv2.rectangle(
            canvas,
            (int(0.23 * IMAGE_WIDTH), int(0.78 * IMAGE_HEIGHT)),
            (int(0.72 * IMAGE_WIDTH), int(0.81 * IMAGE_HEIGHT)),
            (200, 200, 200),
            -10,
        )

        cv2.rectangle(
            canvas,
            (int(0.23 * IMAGE_WIDTH), int(0.78 * IMAGE_HEIGHT)),
            (int(0.23 * IMAGE_WIDTH) + bar_width, int(0.81 * IMAGE_HEIGHT)),
            (220, 130, 130),
            -1,
        )

        # Added better text positioning
        exp_text = (
            f"{exp_current_level}/{EXP_PER_LVL[level]} EXP" if level > 0 else "未评级"
        )
        cv2.putText(
            canvas,
            exp_text,
            (int(0.74 * IMAGE_WIDTH), int(0.83 * IMAGE_HEIGHT)),
            cv2.FONT_HERSHEY_SIMPLEX,
            1.2,
            (255, 255, 255),
            2,
        )

        cv2.imwrite(f"store/usercard_{payload['dcTag']}.jpg", canvas)
    except Exception as e:
        raise e
    finally:
        # Ensure cleanup happens even if there's an error
        if os.path.exists("avatar.jpg"):
            os.remove("avatar.jpg")


class UserCard(Resource):
    def post(self):
        """Added better error handling and response formatting"""
        parser = reqparse.RequestParser()
        required_fields = {
            "dcName": str,
            "dcTag": str,
            "dcId": str,
            "avatarId": str,
            "exp": int,
            "qualified": bool,
        }

        for field, field_type in required_fields.items():
            parser.add_argument(field, type=field_type, required=True)

        try:
            args = parser.parse_args()
            build_profile_image(args)
            return jsonify(
                {"message": "Profile image generated successfully", "error": None}
            )
        except Exception as e:
            logging.error(f"Profile image generation failed: {e}")
            return (
                jsonify(
                    {"message": "Profile image generation failed", "error": str(e)}
                ),
                500,
            )


# Added basic logging configuration
logging.basicConfig(level=logging.INFO)

app = Flask(__name__)
api = Api(app)
api.add_resource(UserCard, "/usercard")

if __name__ == "__main__":
    app.run(debug=True, port=3721)
