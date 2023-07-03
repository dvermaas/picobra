import json
import csv

import pandas as pd

with open("questions.json", 'r', encoding='utf-8') as file:
    data = json.load(file)

data_index_list = [int(i) for i in data[1]]

output = []
for index in data_index_list:
    entry_dict = data[index]
    for key, value in entry_dict.items():
        if int(value) > data_index_list[-1]:
            entry_dict[key] = data[int(value)]
    output.append(entry_dict)

df = pd.DataFrame.from_records(output)
#df.to_csv('output.csv', index=False)
pd.DataFrame.from_records(output)